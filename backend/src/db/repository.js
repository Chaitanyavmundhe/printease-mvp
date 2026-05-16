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
    `insert into documents (id, user_id, file_name, file_type, file_size, file_url, created_at)
     values ($1, $2, $3, $4, $5, $6, coalesce($7, now()))
     returning *`,
    [
      document.id,
      document.userId || null,
      document.fileName,
      document.fileType || null,
      document.fileSize || null,
      document.fileUrl,
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

export async function updateOrderStatus(orderId, centreId, status) {
  const result = await query(
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
