import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect } from './common.js';
import { mapPrintJob } from './mappers.js';
import { findOrderByIdOrCode } from './orderRepository.js';
import { withTransaction } from '../../config/db.js';
import { assertPrintJobTransition } from '../../services/printJobStatusPolicy.js';

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
  // Submission to the spooler is still active work, not permission to enqueue
  // another copy before the desktop has completed or cancelled that job.
  const result = await executor(client).query(
    `select *
     from print_jobs
     where order_id = $1
       and hub_id = $2
       and status in ('queued', 'assigned', 'accepted', 'downloading', 'printing', 'submitted_to_printer')
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
       and agent_id = $3
     limit 1`,
    [jobId, hubId, agentId]
  );

  return mapPrintJob(result.rows[0]);
}

export async function findNextPrintJobForAgent(agentId, hubId, client) {
  // A deleted/unprepared file blocks the whole multi-file job. Lock only pj:
  // the outer joins cannot safely participate in an unqualified FOR UPDATE.
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
         'collected',
         'completed',
         'failed',
         'submitted_to_printer'
       )
       and exists (
         select 1
         from print_order_files pof
         join documents d on d.id = pof.document_id
         where pof.order_id = po.id
       )
       and not exists (
         select 1
         from print_order_files pof
         left join documents d on d.id = pof.document_id
         where pof.order_id = po.id
           and not coalesce((
             (
               d.print_ready_storage_path is not null
               and d.print_ready_storage_path <> ''
               and d.print_ready_sha256 is not null
               and d.print_ready_sha256 <> ''
             )
             or (
               lower(coalesce(d.file_type, '')) = 'application/pdf'
               and d.storage_path is not null
               and d.storage_path <> ''
               and d.file_sha256 is not null
               and d.file_sha256 <> ''
             )
           ) and d.preparation_status = 'prepared' and coalesce(d.prepared_page_count, d.page_count, 0) > 0, false)
       )
     order by pj.created_at asc
     limit 1
     for update of pj skip locked`,
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
  if (!client) return withTransaction(transaction => updatePrintJobStatus(jobId, hubId, updates, transaction));
  const original = await findPrintJobForAgent(jobId, updates.agentId, hubId, client);
  if (!original) return null;
  // Queueing, cancellation and agent reports lock the order first so a delayed
  // report cannot resurrect work after a hub cancellation commits.
  const order = await findOrderByIdOrCode(original.orderId, client, { forUpdate: true });
  if (!order) return null;
  const locked = await client.query('select * from print_jobs where id = $1 for update', [jobId]);
  const current = mapPrintJob(locked.rows[0]);
  if (!current || current.hubId !== hubId || !updates.agentId || current.agentId !== updates.agentId) return null;
  const agent = await client.query(
    'select * from agents where id = $1 and hub_id = $2 and revoked_at is null for share',
    [updates.agentId, hubId]
  );
  if (!agent.rows[0]) return null;
  const advancing = ['accepted', 'downloading', 'printing', 'submitted_to_printer', 'completed'].includes(updates.status);
  if (advancing && (agent.rows[0].paused ||
      !['verified', 'collected'].includes(String(order.paymentStatus || '').toLowerCase()) ||
      ['paused', 'refund requested', 'ready for pickup', 'collected'].includes(String(order.status || '').toLowerCase()))) {
    const error = new Error('Print job is not authorized for paid printing.');
    error.statusCode = 409;
    throw error;
  }
  if (['completed', 'failed', 'cancelled'].includes(current.status) && order.status !== current.status) {
    const error = new Error('Stale terminal print report does not match the current order state.');
    error.statusCode = 409;
    throw error;
  }
  assertPrintJobTransition(current, updates.status, order);
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
       and agent_id = $6
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
