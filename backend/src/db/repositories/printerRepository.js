import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect, normalizeAgentPrinterStatus } from './common.js';
import { mapPrinter, mapAgentPrinter, mapAgent } from './mappers.js';

export async function createPrinter(printer) {
  const result = await query(
    `insert into printers (
       id, hub_id, printer_name, printer_type, protocol, ip_address, port, status, is_active, created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, now()))
     returning *, hub_id as centre_id`,
    [
      printer.id,
      printer.centreId,
      printer.printerName,
      printer.printerType,
      printer.protocol,
      printer.ipAddress,
      printer.port,
      printer.status,
      printer.isActive,
      printer.createdAt || null
    ]
  );

  return mapPrinter(result.rows[0]);
}

export async function listPrintersByCentre(centreId) {
  const result = await query('select *, hub_id as centre_id from printers where hub_id = $1 order by created_at desc', [centreId]);
  return result.rows.map(mapPrinter);
}

export async function findPrinterByIdAndCentre(printerId, centreId) {
  const result = await query(
    'select *, hub_id as centre_id from printers where id = $1 and hub_id = $2',
    [printerId, centreId]
  );
  return mapPrinter(result.rows[0]);
}

export async function updatePrinterStatus(printerId, centreId, status) {
  const result = await query(
    'update printers set status = coalesce($3, status) where id = $1 and hub_id = $2 returning *, hub_id as centre_id',
    [printerId, centreId, status]
  );
  return mapPrinter(result.rows[0]);
}

export async function updatePrinterProtocol(printerId, centreId, updates) {
  const result = await query(
    `update printers
     set
       protocol = coalesce($3, protocol),
       ip_address = coalesce($4, ip_address),
       port = coalesce($5, port)
     where id = $1 and hub_id = $2
     returning *, hub_id as centre_id`,
    [printerId, centreId, updates.protocol, updates.ipAddress, updates.port]
  );

  return mapPrinter(result.rows[0]);
}

export async function replaceAgentPrinters(agentId, hubId, printers = [], client) {
  await executor(client).query('delete from agent_printers where agent_id = $1 and hub_id = $2', [agentId, hubId]);

  const savedPrinters = [];

  for (const printer of printers) {
    const result = await executor(client).query(
      `insert into agent_printers (
         agent_id, hub_id, printer_name, system_printer_id, status, condition, accepting,
         is_default, warning_code, warning_text, last_checked_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, coalesce($11::timestamptz, now()))
       returning *`,
      [
        agentId,
        hubId,
        printer.printerName,
        printer.systemPrinterId || null,
        normalizeAgentPrinterStatus(printer.status || printer.condition),
        printer.condition || printer.status || 'unknown',
        typeof printer.accepting === 'boolean' ? printer.accepting : null,
        Boolean(printer.isDefault),
        printer.warningCode || null,
        printer.warningText || null,
        printer.lastCheckedAt || null
      ]
    );

    savedPrinters.push(mapAgentPrinter(result.rows[0]));
  }

  return savedPrinters;
}

export async function listAgentPrintersByHub(hubId, client) {
  const result = await executor(client).query(
    `select *
     from agent_printers
     where hub_id = $1
     order by is_default desc, last_checked_at desc nulls last, created_at desc`,
    [hubId]
  );

  return result.rows.map(mapAgentPrinter);
}

export async function listAgentPrintersByAgent(agentId, hubId, client) {
  const result = await executor(client).query(
    `select *
     from agent_printers
     where agent_id = $1 and hub_id = $2
     order by is_default desc, last_checked_at desc nulls last, created_at desc`,
    [agentId, hubId]
  );

  return result.rows.map(mapAgentPrinter);
}

export async function findBestAvailableAgentPrinterForHub(hubId, client) {
  const result = await executor(client).query(
    `select
       a.id as agent_id,
       a.hub_id as agent_hub_id,
       a.agent_name,
       a.device_id,
       a.platform,
       a.version,
       a.status as agent_status,
       a.paused,
       a.last_seen_at,
       a.paired_at,
       a.revoked_at,
       a.created_at as agent_created_at,
       p.id as printer_id,
       p.hub_id as printer_hub_id,
       p.printer_name,
       p.system_printer_id,
       p.status as printer_status,
       p.condition as printer_condition,
       p.accepting as printer_accepting,
       p.is_default,
       p.warning_code,
       p.warning_text,
       p.last_checked_at,
       p.created_at as printer_created_at
     from agents a
     join agent_printers p on p.agent_id = a.id and p.hub_id = a.hub_id
     where a.hub_id = $1
       and a.revoked_at is null
       and a.paused = false
       and a.last_seen_at >= now() - interval '45 seconds'
       and lower(coalesce(p.condition, p.status, 'unknown')) not in (
         'paused', 'disabled', 'stopped', 'offline', 'unable', 'disconnected'
       )
       and coalesce(p.accepting, true) = true
       and (
         lower(coalesce(p.condition, '')) in ('available', 'idle', 'enabled', 'accepting')
         or lower(coalesce(p.status, '')) in ('idle', 'available', 'enabled', 'accepting')
       )
     order by
       p.is_default desc,
       case
         when lower(coalesce(p.condition, p.status, '')) in ('idle', 'available', 'enabled', 'accepting') then 0
         when lower(coalesce(p.condition, p.status, '')) = 'printing' then 1
         when lower(coalesce(p.condition, p.status, '')) = 'unknown' then 2
         else 3
       end asc,
       a.last_seen_at desc,
       p.last_checked_at desc nulls last
     limit 1`,
    [hubId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    agent: mapAgent({
      id: row.agent_id,
      hub_id: row.agent_hub_id,
      agent_name: row.agent_name,
      device_id: row.device_id,
      platform: row.platform,
      version: row.version,
      status: row.agent_status,
      paused: row.paused,
      last_seen_at: row.last_seen_at,
      paired_at: row.paired_at,
      revoked_at: row.revoked_at,
      created_at: row.agent_created_at
    }),
    printer: mapAgentPrinter({
      id: row.printer_id,
      agent_id: row.agent_id,
      hub_id: row.printer_hub_id,
      printer_name: row.printer_name,
      system_printer_id: row.system_printer_id,
      status: row.printer_status,
      condition: row.printer_condition,
      accepting: row.printer_accepting,
      is_default: row.is_default,
      warning_code: row.warning_code,
      warning_text: row.warning_text,
      last_checked_at: row.last_checked_at,
      created_at: row.printer_created_at
    })
  };
}

export async function upsertPrinterProfile(hubId, platform, printerName, profile) {
  const result = await query(
    `insert into printer_print_profiles (
      hub_id,
      os_platform,
      printer_name,
      system_printer_id,
      default_orientation,
      default_duplex_binding,
      landscape_duplex_binding,
      back_side_rotation,
      reverse_page_order,
      scale_mode,
      "collate",
      last_tested_at,
      updated_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now()
    ) on conflict (hub_id, os_platform, printer_name) do update set
      system_printer_id = excluded.system_printer_id,
      default_orientation = excluded.default_orientation,
      default_duplex_binding = excluded.default_duplex_binding,
      landscape_duplex_binding = excluded.landscape_duplex_binding,
      back_side_rotation = excluded.back_side_rotation,
      reverse_page_order = excluded.reverse_page_order,
      scale_mode = excluded.scale_mode,
      "collate" = excluded."collate",
      last_tested_at = excluded.last_tested_at,
      updated_at = now()
    returning *`,
    [
      hubId,
      platform,
      printerName,
      profile.systemPrinterId || printerName,
      profile.defaultOrientation || 'auto',
      profile.defaultDuplexBinding || 'auto',
      profile.landscapeDuplexBinding || null,
      profile.backSideRotation || 'auto',
      profile.reversePageOrder || false,
      profile.scaleMode || 'fit-to-page',
      profile.collate ?? true
    ]
  );
  return result.rows[0];
}

export async function getPrinterProfile(hubId, platform, printerName) {
  const result = await query(
    `select * from printer_print_profiles
     where hub_id = $1 and os_platform = $2 and printer_name = $3`,
    [hubId, platform, printerName]
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    hubId: row.hub_id,
    printerName: row.printer_name,
    systemPrinterId: row.system_printer_id,
    osPlatform: row.os_platform,
    defaultOrientation: row.default_orientation,
    defaultDuplexBinding: row.default_duplex_binding,
    landscapeDuplexBinding: row.landscape_duplex_binding,
    backSideRotation: row.back_side_rotation,
    reversePageOrder: row.reverse_page_order,
    scaleMode: row.scale_mode,
    collate: row.collate,
    lastTestedAt: row.last_tested_at
  };
}

export async function getPrinterProfilesByName(hubId, printerName) {
  const result = await query(
    `select * from printer_print_profiles
     where hub_id = $1 and printer_name = $2`,
    [hubId, printerName]
  );
  return result.rows.map(row => ({
    id: row.id,
    hubId: row.hub_id,
    printerName: row.printer_name,
    systemPrinterId: row.system_printer_id,
    osPlatform: row.os_platform,
    defaultOrientation: row.default_orientation,
    defaultDuplexBinding: row.default_duplex_binding,
    landscapeDuplexBinding: row.landscape_duplex_binding,
    backSideRotation: row.back_side_rotation,
    reversePageOrder: row.reverse_page_order,
    scaleMode: row.scale_mode,
    collate: row.collate,
    lastTestedAt: row.last_tested_at
  }));
}
