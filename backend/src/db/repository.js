import { pool, query, withTransaction } from '../config/db.js';

function timestamp(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function number(value) {
  return value === null || value === undefined ? value : Number(value);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

export function mapUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    passwordHash: row.password_hash,
    role: row.role,
    centreId: row.hub_id || row.centre_id || null,
    hubId: row.hub_id || row.centre_id || null,
    hubName: row.hub_name || null,
    centreCode: row.centre_code || null,
    createdAt: timestamp(row.created_at)
  };
}

export function mapCentre(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name || row.hub_name,
    hubName: row.hub_name || row.name,
    ownerId: row.owner_id,
    owner: row.owner_name,
    centreCode: row.centre_code,
    code: row.code || row.centre_code,
    mobile: row.mobile,
    status: row.status,
    upiId: row.upi_id,
    pricing: {
      bwSingle: number(row.bw_single) ?? 1,
      bwDouble: number(row.bw_double) ?? 1.5,
      colorSingle: number(row.color_single) ?? 2,
      colorDouble: number(row.color_double) ?? 3,
      watermarkCharge: number(row.watermark_charge) ?? 2
    },
    createdAt: timestamp(row.created_at)
  };
}

export function mapDocument(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    fileUrl: row.file_url,
    storagePath: row.storage_path || null,
    fileSha256: row.file_sha256 || null,
    createdAt: timestamp(row.created_at)
  };
}

export function mapOrder(row) {
  if (!row) return null;

  return {
    id: row.id,
    orderCode: row.order_code,
    userId: row.user_id,
    centreId: row.centre_id || row.hub_id,
    documentId: row.document_url || row.document_id || null,
    documentName: row.document_name,
    documentUrl: row.document_url || null,
    pages: row.pages,
    copies: row.copies,
    colorType: row.color_type,
    sideType: row.side_type,
    watermarkEnabled: row.watermark_enabled,
    amount: number(row.amount),
    paymentStatus: row.payment_status,
    status: row.status,
    pickupCode: row.pickup_code,
    createdAt: timestamp(row.created_at)
  };
}

export function mapPayment(row) {
  if (!row) return null;

  return {
    id: row.id,
    orderId: row.order_id,
    amount: number(row.amount),
    method: row.method,
    gateway: row.method,
    transactionId: row.transaction_id,
    gatewayOrderId: row.transaction_id,
    gatewayPaymentId: row.transaction_id,
    status: row.status,
    createdAt: timestamp(row.created_at),
    verifiedAt: timestamp(row.verified_at)
  };
}

export function mapPrinter(row) {
  if (!row) return null;

  return {
    id: row.id,
    centreId: row.centre_id || row.hub_id,
    printerName: row.printer_name,
    printerType: row.printer_type,
    protocol: row.protocol,
    ipAddress: row.ip_address,
    port: row.port,
    status: row.status,
    isActive: row.is_active,
    createdAt: timestamp(row.created_at)
  };
}

export function mapAgent(row) {
  if (!row) return null;

  return {
    id: row.id,
    hubId: row.hub_id,
    agentName: row.agent_name,
    deviceId: row.device_id,
    platform: row.platform,
    version: row.version,
    status: row.status,
    paused: row.paused,
    lastSeenAt: timestamp(row.last_seen_at),
    pairedAt: timestamp(row.paired_at),
    revokedAt: timestamp(row.revoked_at),
    createdAt: timestamp(row.created_at)
  };
}

export function mapPairingSession(row) {
  if (!row) return null;

  return {
    id: row.id,
    pairingCodeHash: row.pairing_code_hash,
    deviceId: row.device_id,
    agentName: row.agent_name,
    platform: row.platform,
    version: row.version,
    status: row.status,
    hubId: row.hub_id,
    agentId: row.agent_id,
    expiresAt: timestamp(row.expires_at),
    createdAt: timestamp(row.created_at),
    claimedAt: timestamp(row.claimed_at)
  };
}

export function mapAgentPrinter(row) {
  if (!row) return null;

  return {
    id: row.id,
    agentId: row.agent_id,
    hubId: row.hub_id,
    printerName: row.printer_name,
    systemPrinterId: row.system_printer_id,
    status: row.status,
    isDefault: row.is_default,
    lastCheckedAt: timestamp(row.last_checked_at),
    createdAt: timestamp(row.created_at)
  };
}

export function mapPrintJob(row) {
  if (!row) return null;

  return {
    id: row.id,
    jobId: row.id,
    orderId: row.order_id,
    hubId: row.hub_id,
    agentId: row.agent_id,
    printerName: row.printer_name,
    status: row.status,
    fileUrl: row.file_url,
    fileSha256: row.file_sha256,
    fileHash: row.file_sha256,
    fileType: row.file_type,
    copies: row.copies,
    paperSize: row.paper_size,
    colorMode: row.color_mode,
    sourceBackendUrl: row.source_backend_url,
    failureReasonCode: row.failure_reason_code,
    failureReasonText: row.failure_reason_text,
    createdAt: timestamp(row.created_at),
    acceptedAt: timestamp(row.accepted_at),
    printingStartedAt: timestamp(row.printing_started_at),
    completedAt: timestamp(row.completed_at),
    failedAt: timestamp(row.failed_at)
  };
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
    c.bw_single,
    c.bw_double,
    c.color_single,
    c.color_double,
    c.watermark_charge,
    c.created_at,
    u.name as owner_name
  from print_hubs c
  left join users u on u.id = c.owner_id
`;

function executor(client) {
  return client || pool;
}

export { withTransaction };

export async function findUserById(id, client) {
  const result = await executor(client).query(
    `select
       u.*,
       h.id as hub_id,
       h.id as centre_id,
       h.hub_name,
       h.centre_code
     from users u
     left join print_hubs h on h.owner_id = u.id
     where u.id = $1`,
    [id]
  );
  return mapUser(result.rows[0]);
}

export async function findUserByMobile(mobile, client) {
  const result = await executor(client).query(
    `select
       u.*,
       h.id as hub_id,
       h.id as centre_id,
       h.hub_name,
       h.centre_code
     from users u
     left join print_hubs h on h.owner_id = u.id
     where u.mobile = $1`,
    [mobile]
  );
  return mapUser(result.rows[0]);
}

export async function createUser(user, client) {
  const result = await executor(client).query(
    `insert into users (id, name, mobile, password_hash, role, created_at)
     values ($1, $2, $3, $4, $5, coalesce($6, now()))
     returning *, null::uuid as hub_id, null::uuid as centre_id, null::text as hub_name, null::text as centre_code`,
    [user.id, user.name, user.mobile, user.passwordHash, user.role, user.createdAt || null]
  );

  return mapUser(result.rows[0]);
}

export async function listCentres() {
  const result = await query(`${centreSelect} order by c.created_at desc`);
  return result.rows.map(mapCentre);
}

export async function findCentreByCode(code, client) {
  const result = await executor(client).query(`${centreSelect} where c.centre_code = $1`, [code]);
  return mapCentre(result.rows[0]);
}

export async function findCentreById(id, client) {
  const result = await executor(client).query(`${centreSelect} where c.id = $1`, [id]);
  return mapCentre(result.rows[0]);
}

export async function findCentreForUser(user, client) {
  if (!user || user.role !== 'hub') return null;

  const result = await executor(client).query(
    `${centreSelect} where c.id = $1 or c.owner_id = $2 limit 1`,
    [user.centreId, user.id]
  );

  return mapCentre(result.rows[0]);
}

export async function createCentre(centre, client) {
  const pricing = centre.pricing || {};
  const result = await executor(client).query(
    `insert into print_hubs (
       id, owner_id, hub_name, centre_code, mobile, status, upi_id,
       bw_single, bw_double, color_single, color_double, watermark_charge, created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, coalesce($13, now()))
     returning *`,
    [
      centre.id,
      centre.ownerId,
      centre.hubName || centre.name,
      centre.centreCode,
      centre.mobile,
      centre.status || 'available',
      centre.upiId || null,
      pricing.bwSingle ?? centre.bwSingle ?? 1,
      pricing.bwDouble ?? centre.bwDouble ?? 1.5,
      pricing.colorSingle ?? centre.colorSingle ?? 2,
      pricing.colorDouble ?? centre.colorDouble ?? 3,
      pricing.watermarkCharge ?? centre.watermarkCharge ?? 2,
      centre.createdAt || null
    ]
  );

  return findCentreById(result.rows[0].id, client);
}

export async function updateCentrePricing(centreId, pricing) {
  const result = await query(
    `update print_hubs
     set
       bw_single = coalesce($2, bw_single),
       bw_double = coalesce($3, bw_double),
       color_single = coalesce($4, color_single),
       color_double = coalesce($5, color_double),
       watermark_charge = coalesce($6, watermark_charge)
     where id = $1
     returning id`,
    [
      centreId,
      pricing.bwSingle,
      pricing.bwDouble,
      pricing.colorSingle,
      pricing.colorDouble,
      pricing.watermarkCharge
    ]
  );

  if (!result.rows[0]) return null;
  return findCentreById(result.rows[0].id);
}

export async function updateCentrePaymentMethod(centreId, upiId) {
  const result = await query(
    'update print_hubs set upi_id = coalesce($2, upi_id) where id = $1 returning id',
    [centreId, upiId]
  );

  if (!result.rows[0]) return null;
  return findCentreById(result.rows[0].id);
}

export async function createDocument(document) {
  const result = await query(
    `insert into documents (
       id,
       user_id,
       file_name,
       file_type,
       file_size,
       file_url,
       storage_path,
       file_sha256,
       created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, now()))
     returning *`,
    [
      document.id,
      document.userId || null,
      document.fileName,
      document.fileType || null,
      document.fileSize || null,
      document.fileUrl || null,
      document.storagePath || null,
      document.fileSha256 || null,
      document.createdAt || null
    ]
  );

  return mapDocument(result.rows[0]);
}

export async function createOrder(order) {
  const result = await query(
    `insert into print_orders (
       id, order_code, user_id, hub_id, document_name, document_url, pages, copies,
       color_type, side_type, watermark_enabled, amount, payment_status, status, pickup_code, created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, coalesce($16, now()))
     returning *, hub_id as centre_id`,
    [
      order.id,
      order.orderCode,
      order.userId || null,
      order.centreId,
      order.documentName,
      order.documentUrl || order.documentId || null,
      order.pages,
      order.copies,
      order.colorType,
      order.sideType,
      order.watermarkEnabled,
      order.amount,
      order.paymentStatus,
      order.status,
      order.pickupCode,
      order.createdAt || null
    ]
  );

  return mapOrder(result.rows[0]);
}

export async function findOrderByIdOrCode(id, client) {
  if (!isUuid(id)) {
    const result = await executor(client).query(
      'select *, hub_id as centre_id from print_orders where order_code = $1',
      [id]
    );
    return mapOrder(result.rows[0]);
  }

  const result = await executor(client).query(
    'select *, hub_id as centre_id from print_orders where id = $1::uuid or order_code = $2',
    [id, id]
  );
  return mapOrder(result.rows[0]);
}

export async function listOrdersByUser(userId) {
  const result = await query('select *, hub_id as centre_id from print_orders where user_id = $1 order by created_at desc', [userId]);
  return result.rows.map(mapOrder);
}

export async function listOrdersByCentre(centreId) {
  const result = await query('select *, hub_id as centre_id from print_orders where hub_id = $1 order by created_at desc', [centreId]);
  return result.rows.map(mapOrder);
}

export async function updateOrderStatus(orderId, centreId, status, client) {
  const result = await executor(client).query(
    'update print_orders set status = coalesce($3, status) where id = $1 and hub_id = $2 returning *, hub_id as centre_id',
    [orderId, centreId, status]
  );
  return mapOrder(result.rows[0]);
}

export async function updateOrderPayment(orderId, paymentStatus, status, client) {
  const result = await executor(client).query(
    'update print_orders set payment_status = $2, status = $3 where id = $1 returning *, hub_id as centre_id',
    [orderId, paymentStatus, status]
  );
  return mapOrder(result.rows[0]);
}

export async function createPayment(payment) {
  const result = await query(
    `insert into payments (
       id, order_id, amount, method, transaction_id, status, created_at, verified_at
     )
     values ($1, $2, $3, $4, $5, $6, coalesce($7, now()), $8)
     returning *`,
    [
      payment.id,
      payment.orderId,
      payment.amount,
      payment.method || payment.gateway || 'DEMO_UPI',
      payment.transactionId || payment.gatewayPaymentId || payment.gatewayOrderId || null,
      payment.status,
      payment.createdAt || null,
      payment.verifiedAt || null
    ]
  );

  return mapPayment(result.rows[0]);
}

export async function findPaymentById(id, client) {
  const result = await executor(client).query('select * from payments where id = $1', [id]);
  return mapPayment(result.rows[0]);
}

export async function updatePayment(paymentId, updates, client) {
  const result = await executor(client).query(
    `update payments
     set
       transaction_id = coalesce($2, transaction_id),
       status = coalesce($3, status),
       verified_at = coalesce($4, verified_at)
     where id = $1
     returning *`,
    [paymentId, updates.transactionId || updates.gatewayPaymentId, updates.status, updates.verifiedAt]
  );

  return mapPayment(result.rows[0]);
}

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

export async function createAgentPairingSession(session, client) {
  const result = await executor(client).query(
    `insert into agent_pairing_sessions (
       id, pairing_code_hash, device_id, agent_name, platform, version, status, expires_at, created_at
     )
     values ($1, $2, $3, $4, $5, $6, 'pending', $7, coalesce($8, now()))
     returning *`,
    [
      session.id,
      session.pairingCodeHash,
      session.deviceId,
      session.agentName,
      session.platform || null,
      session.version || null,
      session.expiresAt,
      session.createdAt || null
    ]
  );

  return mapPairingSession(result.rows[0]);
}

export async function findPendingPairingSessionByCodeHash(pairingCodeHash, client) {
  const result = await executor(client).query(
    `select *
     from agent_pairing_sessions
     where pairing_code_hash = $1
       and status = 'pending'
       and expires_at > now()
     order by created_at desc
     limit 1`,
    [pairingCodeHash]
  );

  return mapPairingSession(result.rows[0]);
}

export async function findPairingSessionByIdAndDevice(sessionId, deviceId, client) {
  const result = await executor(client).query(
    'select * from agent_pairing_sessions where id = $1 and device_id = $2',
    [sessionId, deviceId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function upsertAgentForPairing(session, hubId, client) {
  const result = await executor(client).query(
    `insert into agents (
       hub_id, agent_name, device_id, platform, version, status, paused, paired_at, revoked_at, created_at
     )
     values ($1, $2, $3, $4, $5, 'offline', false, now(), null, now())
     on conflict (device_id)
     do update set
       hub_id = excluded.hub_id,
       agent_name = excluded.agent_name,
       platform = excluded.platform,
       version = excluded.version,
       revoked_at = null,
       paired_at = now()
     returning *`,
    [hubId, session.agentName, session.deviceId, session.platform || null, session.version || null]
  );

  return mapAgent(result.rows[0]);
}

export async function upsertAgentForDesktopDevice(device, hubId, client) {
  const result = await executor(client).query(
    `insert into agents (
       hub_id, agent_name, device_id, platform, version, status, paused, paired_at, revoked_at, created_at
     )
     values ($1, $2, $3, $4, $5, 'offline', false, now(), null, now())
     on conflict (device_id)
     do update set
       hub_id = excluded.hub_id,
       agent_name = excluded.agent_name,
       platform = excluded.platform,
       version = excluded.version,
       revoked_at = null,
       paired_at = coalesce(agents.paired_at, now())
     returning *`,
    [hubId, device.deviceName, device.deviceId, device.platform || null, device.version || null]
  );

  return mapAgent(result.rows[0]);
}

export async function claimPairingSession(sessionId, hubId, agentId, client) {
  const result = await executor(client).query(
    `update agent_pairing_sessions
     set status = 'claimed',
         hub_id = $2,
         agent_id = $3,
         claimed_at = now()
     where id = $1
       and status = 'pending'
       and expires_at > now()
     returning *`,
    [sessionId, hubId, agentId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function markPairingSessionConfirmed(sessionId, client) {
  const result = await executor(client).query(
    `update agent_pairing_sessions
     set status = 'confirmed'
     where id = $1
       and status = 'claimed'
     returning *`,
    [sessionId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function createAgentToken(token, client) {
  const result = await executor(client).query(
    `insert into agent_tokens (agent_id, token_hash, expires_at)
     values ($1, $2, $3)
     returning *`,
    [token.agentId, token.tokenHash, token.expiresAt || null]
  );

  return result.rows[0];
}

export async function revokeActiveAgentTokens(agentId, client) {
  await executor(client).query(
    'update agent_tokens set revoked_at = now() where agent_id = $1 and revoked_at is null',
    [agentId]
  );
}

export async function findActiveAgentByTokenHash(tokenHash, client) {
  const result = await executor(client).query(
    `select
       a.*,
       t.id as token_id,
       t.revoked_at as token_revoked_at,
       t.expires_at as token_expires_at
     from agent_tokens t
     join agents a on a.id = t.agent_id
     where t.token_hash = $1
       and t.revoked_at is null
       and a.revoked_at is null
       and (t.expires_at is null or t.expires_at > now())
     limit 1`,
    [tokenHash]
  );

  return mapAgent(result.rows[0]);
}

export async function updateAgentHeartbeat(agentId, updates, client) {
  const result = await executor(client).query(
    `update agents
     set status = coalesce($2, status),
         paused = coalesce($3, paused),
         platform = coalesce($4, platform),
         version = coalesce($5, version),
         last_seen_at = now()
     where id = $1 and revoked_at is null
     returning *`,
    [agentId, updates.status, updates.paused, updates.platform, updates.version]
  );

  return mapAgent(result.rows[0]);
}

export async function listAgentsByHub(hubId, client) {
  const result = await executor(client).query(
    `select *
     from agents
     where hub_id = $1 and revoked_at is null
     order by coalesce(last_seen_at, created_at) desc`,
    [hubId]
  );

  return result.rows.map(mapAgent);
}

export async function findAgentByIdAndHub(agentId, hubId, client) {
  const result = await executor(client).query(
    'select * from agents where id = $1 and hub_id = $2 and revoked_at is null',
    [agentId, hubId]
  );

  return mapAgent(result.rows[0]);
}

export async function setAgentPaused(agentId, hubId, paused, client) {
  const result = await executor(client).query(
    `update agents
     set paused = $3,
         status = case when $3 then 'paused' else 'offline' end
     where id = $1 and hub_id = $2 and revoked_at is null
     returning *`,
    [agentId, hubId, paused]
  );

  return mapAgent(result.rows[0]);
}

export async function revokeAgent(agentId, hubId, client) {
  const result = await executor(client).query(
    `update agents
     set revoked_at = now(),
         status = 'revoked'
     where id = $1 and hub_id = $2 and revoked_at is null
     returning *`,
    [agentId, hubId]
  );

  if (!result.rows[0]) return null;

  await executor(client).query(
    'update agent_tokens set revoked_at = now() where agent_id = $1 and revoked_at is null',
    [agentId]
  );

  return mapAgent(result.rows[0]);
}

export async function replaceAgentPrinters(agentId, hubId, printers = [], client) {
  await executor(client).query('delete from agent_printers where agent_id = $1 and hub_id = $2', [agentId, hubId]);

  const savedPrinters = [];

  for (const printer of printers) {
    const result = await executor(client).query(
      `insert into agent_printers (
         agent_id, hub_id, printer_name, system_printer_id, status, is_default, last_checked_at
       )
       values ($1, $2, $3, $4, $5, $6, now())
       returning *`,
      [
        agentId,
        hubId,
        printer.printerName,
        printer.systemPrinterId || null,
        printer.status || 'unknown',
        Boolean(printer.isDefault)
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

export async function findOrderWithDocumentForHub(orderId, hubId, client) {
  const result = await executor(client).query(
    `select
       po.*,
       po.hub_id as centre_id,
       d.id as document_id,
       d.file_url as document_file_url,
       d.file_sha256 as document_file_sha256,
       d.file_type as document_file_type,
       d.storage_path as document_storage_path
     from print_orders po
     left join documents d on d.id::text = po.document_url
     where po.id = $1 and po.hub_id = $2`,
    [orderId, hubId]
  );

  return result.rows[0] || null;
}

export async function createPrintJob(job, client) {
  const result = await executor(client).query(
    `insert into print_jobs (
       id, order_id, hub_id, agent_id, printer_name, status, file_url, file_sha256,
       file_type, copies, paper_size, color_mode, source_backend_url, created_at
     )
     values ($1, $2, $3, $4, $5, 'queued', $6, $7, $8, $9, $10, $11, $12, now())
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
      job.sourceBackendUrl
    ]
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

export async function listDesktopOrdersForAgent(hubId, since = null, client) {
  const result = await executor(client).query(
    `select
       po.*,
       po.hub_id as centre_id,
       d.id as document_id,
       d.file_name as document_file_name,
       d.file_type as document_file_type,
       d.file_size as document_file_size,
       d.file_sha256 as document_file_sha256,
       d.storage_path as document_storage_path
     from print_orders po
     left join documents d on d.id::text = po.document_url
     where po.hub_id = $1
       and ($2::timestamptz is null or po.created_at >= $2::timestamptz)
     order by po.created_at desc`,
    [hubId, since || null]
  );

  return result.rows.map((row) => ({
    ...mapOrder(row),
    document: {
      id: row.document_id || row.document_url || null,
      fileName: row.document_file_name || row.document_name || null,
      fileType: row.document_file_type || null,
      fileSize: row.document_file_size || null,
      fileSha256: row.document_file_sha256 || null,
      storagePath: row.document_storage_path || null
    }
  }));
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
    `select *
     from print_jobs
     where hub_id = $2
       and (agent_id = $1 or agent_id is null)
       and status in ('queued', 'assigned')
     order by created_at asc
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

    return mapPrintJob(assigned.rows[0]);
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
         failed_at = case when $3 = 'failed' then now() else failed_at end
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
