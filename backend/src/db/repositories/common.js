import { pool, query, withTransaction } from '../../config/db.js';

function timestamp(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function number(value) {
  return value === null || value === undefined ? value : Number(value);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

const centreSelect = `
  select
    c.id,
    c.owner_id,
    c.hub_name,
    c.hub_name as name,
    c.centre_code,
    c.centre_code as code,
    c.mobile,
    c.status,
    c.upi_id,
    c.upi_qr_image_url,
    c.bw_single,
    c.bw_double,
    c.color_single,
    c.color_double,
    c.watermark_charge,
    c.created_at,
    u.name as owner_name,
    c.location_enabled,
    case when c.location_enabled then c.latitude else null end as latitude,
    case when c.location_enabled then c.longitude else null end as longitude,
    c.address_text,
    c.area,
    c.city,
    c.map_updated_at,
    c.after_order_settings,
    exists (
      select 1 from printers p 
      where p.hub_id = c.id
      and p.is_active = true 
      and p.status in ('available', 'idle', 'accepting')
    ) or exists (
      select 1
      from agents a
      where a.hub_id = c.id
        and a.revoked_at is null
        and a.paused = false
        and a.last_seen_at > now() - interval '2 minutes'
        and lower(coalesce(a.status, '')) in ('online', 'active')
    ) or exists (
      select 1
      from agent_printers ap
      join agents a on a.id = ap.agent_id
      where ap.hub_id = c.id
        and a.hub_id = c.id
        and a.revoked_at is null
        and a.paused = false
        and a.last_seen_at > now() - interval '2 minutes'
        and lower(coalesce(ap.status, ap.condition, '')) in ('online', 'available', 'idle', 'accepting')
    ) as printer_online
  from print_hubs c
  left join users u on u.id = c.owner_id
`;

export function executor(client) {
  return client || pool;
}

export { withTransaction };

function normalizeAgentPrinterStatus(rawStatus) {
  const normalized = String(rawStatus || '').toLowerCase().trim();
  if (['idle', 'ready', 'available', 'online'].includes(normalized)) return 'idle';
  if (['printing', 'busy', 'processing'].includes(normalized)) return 'busy';
  if (['error', 'failed'].includes(normalized)) return 'error';
  return 'offline';
}

export { query, timestamp, number, isUuid, centreSelect, normalizeAgentPrinterStatus };
