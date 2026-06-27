import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect } from './common.js';
import { mapPrintJob } from './mappers.js';

export async function createPrintJob(job, client) {
  const result = await executor(client).query(
    `insert into print_jobs (
       id, order_id, hub_id, agent_id, printer_name, status, file_url, file_sha256,
       file_type, copies, paper_size, color_mode, print_options, source_backend_url, created_at
     )
     values ($1, $2, $3, $4, $5, 'queued', $6, $7, $8, $9, $10, $11, $12::jsonb, $13, now())
     returning *`,
    [
      job.id,
      job.orderId,
      job.hubId,
      job.agentId || null,
      job.printerName || null,
      job.fileUrl,
      job.fileSha256 || null,
      job.fileType || 'application/pdf',
      job.copies || 1,
      job.paperSize || 'A4',
      job.colorMode || 'bw',
      JSON.stringify(job.printOptions || {}),
      job.sourceBackendUrl
    ]
  );

  return mapPrintJob(result.rows[0]);
}

export async function findActivePrintJobByOrder(orderId, hubId, client) {
  const result = await executor(client).query(
    `select *
     from print_jobs
     where order_id = $1
       and hub_id = $2
       and status in ('queued', 'assigned', 'accepted', 'downloading', 'printing')
     order by created_at desc
     limit 1`,
    [orderId, hubId]
  );

  return mapPrintJob(result.rows[0]);
}

export async function listPrintJobsByHub(hubId, client) {
  const result = await executor(client).query(
    `select *
     from print_jobs
     where hub_id = $1
     order by created_at desc`,
    [hubId]
  );

  return result.rows.map(mapPrintJob);
}

export async function listDesktopPrintJobsForAgent(agentId, hubId, since = null, client) {
  const result = await executor(client).query(
    `select *
     from print_jobs
     where hub_id = $2
       and (agent_id = $1 or agent_id is null)
       and ($3::timestamptz is null or created_at >= $3::timestamptz)
     order by created_at desc`,
    [agentId, hubId, since || null]
  );

  return result.rows.map(mapPrintJob);
}

export async function findPrintJobForAgent(jobId, agentId, hubId, client) {
  const result = await executor(client).query(
    `select *
     from print_jobs
     where id = $1
       and hub_id = $2
       and (agent_id = $3 or agent_id is null)
     limit 1`,
    [jobId, hubId, agentId]
  );

  return mapPrintJob(result.rows[0]);
}

export async function findNextPrintJobForAgent(agentId, hubId, client) {
  const result = await executor(client).query(
    `select pj.*
     from print_jobs pj
     join agents a on a.id = $1 and a.hub_id = $2
     join print_orders po on po.id = pj.order_id and po.hub_id = pj.hub_id
     where pj.hub_id = $2
       and (pj.agent_id = $1 or pj.agent_id is null)
       and pj.status in ('queued', 'assigned')
       and a.revoked_at is null
       and a.paused = false
       and lower(coalesce(po.payment_status, '')) in ('collected', 'verified')
       and lower(coalesce(po.status, '')) not in (
         'paused',
         'cancelled',
         'refund requested',
         'printing failed',
         'ready for pickup',
         'collected'
       )
       and exists (
         select 1
         from print_order_files pof
         join documents d on d.id = pof.document_id
         where pof.order_id = po.id
           and d.storage_path is not null
           and d.storage_path <> ''
           and d.file_sha256 is not null
           and d.file_sha256 <> ''
           and (
             lower(coalesce(d.file_type, '')) in (
               'application/pdf',
               'image/jpeg',
               'image/png',
               'image/webp',
               'text/plain',
               'text/csv',
               'application/json',
               'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
               'application/vnd.ms-excel',
               'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
               'application/vnd.ms-powerpoint',
               'application/vnd.openxmlformats-officedocument.presentationml.presentation',
               'application/vnd.oasis.opendocument.text',
               'application/vnd.oasis.opendocument.spreadsheet',
               'application/vnd.oasis.opendocument.presentation'
             )
             or d.print_ready_storage_path is not null
           )
       )
     order by pj.created_at asc
     limit 1
     for update skip locked`,
    [agentId, hubId]
  );

  const job = result.rows[0];
  if (!job) return null;

  if (!job.agent_id || job.status === 'queued') {
    const assigned = await executor(client).query(
      `update print_jobs
       set agent_id = $1,
           status = 'assigned'
       where id = $2
       returning *`,
      [agentId, job.id]
    );

    const mapped = mapPrintJob(assigned.rows[0]);
    mapped._claimedByAgent = !job.agent_id;
    return mapped;
  }

  return mapPrintJob(job);
}

export async function insertPrintJobEvent(event, client) {
  const result = await executor(client).query(
    `insert into print_job_events (
       print_job_id, agent_id, event_type, old_status, new_status, message, raw_status
     )
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     returning *`,
    [
      event.printJobId,
      event.agentId || null,
      event.eventType,
      event.oldStatus || null,
      event.newStatus || null,
      event.message || null,
      event.rawStatus ? JSON.stringify(event.rawStatus) : null
    ]
  );

  return result.rows[0];
}

export async function updatePrintJobStatus(jobId, hubId, updates, client) {
  const result = await executor(client).query(
    `update print_jobs
     set status = coalesce($3, status),
         agent_id = coalesce(agent_id, $6),
         failure_reason_code = coalesce($4, failure_reason_code),
         failure_reason_text = coalesce($5, failure_reason_text),
         accepted_at = case when $3 = 'accepted' then now() else accepted_at end,
         printing_started_at = case when $3 = 'printing' then now() else printing_started_at end,
         completed_at = case when $3 = 'completed' then now() else completed_at end,
         failed_at = case when $3 in ('failed', 'cancelled') then now() else failed_at end
     where id = $1
       and hub_id = $2
       and ($6::uuid is null or agent_id = $6 or agent_id is null)
     returning *`,
    [
      jobId,
      hubId,
      updates.status,
      updates.failureReasonCode || null,
      updates.failureReasonText || null,
      updates.agentId || null
    ]
  );

  return mapPrintJob(result.rows[0]);
}
