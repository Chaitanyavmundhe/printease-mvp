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
    email: row.email || null,
    username: row.username || null,
    displayHandle: row.display_handle || row.username || null,
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
    upiQrImageUrl: row.upi_qr_image_url || null,
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
    fileSize: row.file_size_bytes === null || row.file_size_bytes === undefined
      ? row.file_size
      : Number(row.file_size_bytes),
    fileSizeBytes: row.file_size_bytes === null || row.file_size_bytes === undefined
      ? row.file_size
      : Number(row.file_size_bytes),
    fileUrl: row.file_url,
    storagePath: row.storage_path || null,
    fileSha256: row.file_sha256 || null,
    pageCount: row.page_count === null || row.page_count === undefined ? null : Number(row.page_count),
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
    documentPageCount: row.document_page_count === null || row.document_page_count === undefined
      ? null
      : Number(row.document_page_count),
    pages: row.pages,
    copies: row.copies,
    colorType: row.color_type,
    sideType: row.side_type,
    watermarkEnabled: row.watermark_enabled,
    printOptions: row.print_options || {},
    selectedPageCount: row.selected_page_count === null || row.selected_page_count === undefined
      ? null
      : Number(row.selected_page_count),
    printablePageCount: row.printable_page_count === null || row.printable_page_count === undefined
      ? null
      : Number(row.printable_page_count),
    sheetCount: row.sheet_count === null || row.sheet_count === undefined
      ? null
      : Number(row.sheet_count),
    amount: number(row.amount),
    totalAmountPaise: row.total_amount_paise === null || row.total_amount_paise === undefined
      ? Math.round(Number(row.amount || 0) * 100)
      : Number(row.total_amount_paise),
    customerName: row.customer_name || row.user_name || null,
    customerMobile: row.customer_mobile || row.user_mobile || null,
    customerType: row.customer_type || 'registered',
    guestToken: row.guest_token || null,
    guestName: row.guest_name || null,
    guestPhone: row.guest_phone || null,
    priceSnapshot: row.price_snapshot || null,
    printConfigSnapshot: row.print_config_snapshot || null,
    expiresAt: row.expires_at || null,
    paymentStatus: row.payment_status,
    status: row.status,
    pickupCode: row.pickup_code,
    createdAt: timestamp(row.created_at)
  };
}

export function mapOrderFile(row) {
  if (!row) return null;

  return {
    id: row.id,
    orderId: row.order_id,
    documentId: row.document_id,
    originalPageCount: Number(row.original_page_count),
    selectedPages: row.selected_pages,
    selectedPageCount: Number(row.selected_page_count),
    printablePageCount: Number(row.printable_page_count),
    sheetCount: Number(row.sheet_count),
    copies: Number(row.copies),
    printOptions: row.print_options || {},
    lineAmountPaise: Number(row.line_amount_paise),
    amountPaise: Number(row.line_amount_paise),
    printSequence: row.print_sequence === null || row.print_sequence === undefined
      ? null
      : Number(row.print_sequence),
    document: row.document_id
      ? {
          id: row.document_id,
          fileName: row.file_name || null,
          fileType: row.file_type || null,
          fileSize: row.file_size_bytes === null || row.file_size_bytes === undefined
            ? row.file_size || null
            : Number(row.file_size_bytes),
          fileSizeBytes: row.file_size_bytes === null || row.file_size_bytes === undefined
            ? row.file_size || null
            : Number(row.file_size_bytes),
          fileSha256: row.file_sha256 || null,
          storagePath: row.storage_path || null,
          pageCount: row.page_count === null || row.page_count === undefined ? null : Number(row.page_count),
          createdAt: timestamp(row.document_created_at)
        }
      : null,
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
    gateway: row.provider || row.method,
    provider: row.provider || null,
    transactionId: row.transaction_id,
    gatewayOrderId: row.provider_order_id || row.transaction_id,
    gatewayPaymentId: row.provider_payment_id || null,
    providerOrderId: row.provider_order_id || null,
    providerPaymentId: row.provider_payment_id || null,
    providerSignature: row.provider_signature || null,
    providerStatus: row.provider_status || null,
    providerPayload: row.provider_payload || {},
    paymentLinkId: row.payment_link_id || null,
    qrCodeId: row.qr_code_id || null,
    qrImageUrl: row.qr_image_url || null,
    shortUrl: row.short_url || null,
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
    approvalTokenHash: row.approval_token_hash,
    publicKey: row.public_key,
    deviceId: row.device_id,
    agentName: row.agent_name,
    platform: row.platform,
    version: row.version,
    status: row.status,
    hubId: row.hub_id,
    agentId: row.agent_id,
    expiresAt: timestamp(row.expires_at),
    approvalExpiresAt: timestamp(row.approval_expires_at),
    approvedAt: timestamp(row.approved_at),
    rejectedAt: timestamp(row.rejected_at),
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
    condition: row.condition || row.status,
    accepting: row.accepting === null || row.accepting === undefined ? null : Boolean(row.accepting),
    isDefault: row.is_default,
    warningCode: row.warning_code || null,
    warningText: row.warning_text || null,
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
    printOptions: row.print_options || {},
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
    c.upi_qr_image_url,
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

export async function findUserByEmail(email, client) {
  const result = await executor(client).query(
    `select
       u.*,
       h.id as hub_id,
       h.id as centre_id,
       h.hub_name,
       h.centre_code
     from users u
     left join print_hubs h on h.owner_id = u.id
     where lower(u.email) = lower($1)`,
    [email]
  );
  return mapUser(result.rows[0]);
}

export async function findUserByUsername(username, client) {
  const result = await executor(client).query(
    `select
       u.*,
       h.id as hub_id,
       h.id as centre_id,
       h.hub_name,
       h.centre_code
     from users u
     left join print_hubs h on h.owner_id = u.id
     where lower(u.username) = lower($1)`,
    [username]
  );
  return mapUser(result.rows[0]);
}

export async function createUser(user, client) {
  const result = await executor(client).query(
    `insert into users (id, name, email, username, display_handle, mobile, password_hash, role, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, now()))
     returning *, null::uuid as hub_id, null::uuid as centre_id, null::text as hub_name, null::text as centre_code`,
    [
      user.id,
      user.name,
      user.email || null,
      user.username || null,
      user.displayHandle || user.username || null,
      user.mobile || null,
      user.passwordHash || null,
      user.role,
      user.createdAt || null
    ]
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
       id, owner_id, hub_name, centre_code, mobile, status, upi_id, upi_qr_image_url,
       bw_single, bw_double, color_single, color_double, watermark_charge, created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, coalesce($14, now()))
     returning *`,
    [
      centre.id,
      centre.ownerId,
      centre.hubName || centre.name,
      centre.centreCode,
      centre.mobile,
      centre.status || 'available',
      centre.upiId || null,
      centre.upiQrImageUrl || null,
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
      pricing.bwSingle ?? null,
      pricing.bwDouble ?? null,
      pricing.colorSingle ?? null,
      pricing.colorDouble ?? null,
      pricing.watermarkCharge ?? null
    ]
  );

  if (!result.rows[0]) return null;
  return findCentreById(result.rows[0].id);
}

export async function updateCentrePaymentMethod(centreId, upiId) {
  const nextUpiId = typeof upiId === 'object' ? upiId.upiId : upiId;
  const nextQrImageUrl = typeof upiId === 'object' ? upiId.upiQrImageUrl : undefined;
  const result = await query(
    'update print_hubs set upi_id = coalesce($2, upi_id), upi_qr_image_url = coalesce($3, upi_qr_image_url) where id = $1 returning id',
    [centreId, nextUpiId, nextQrImageUrl]
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
       file_size_bytes,
       file_url,
       storage_path,
       file_sha256,
       page_count,
       created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, coalesce($11, now()))
     returning *`,
    [
      document.id,
      document.userId || null,
      document.fileName,
      document.fileType || null,
      document.fileSize || null,
      document.fileSizeBytes || document.fileSize || null,
      document.fileUrl || null,
      document.storagePath || null,
      document.fileSha256 || null,
      document.pageCount || null,
      document.createdAt || null
    ]
  );

  return mapDocument(result.rows[0]);
}

export async function findDocumentById(documentId, client) {
  if (!isUuid(documentId)) return null;

  const result = await executor(client).query('select * from documents where id = $1', [documentId]);
  return mapDocument(result.rows[0]);
}

export async function createOrder(order, client) {
  const result = await executor(client).query(
     `insert into print_orders (
        id, order_code, user_id, hub_id, document_name, document_url, pages, copies,
        color_type, side_type, watermark_enabled, print_options, selected_page_count,
        printable_page_count, sheet_count, amount, total_amount_paise, payment_status,
        status, pickup_code, created_at, customer_type, expires_at,
        guest_token, guest_name, guest_phone, price_snapshot, print_config_snapshot
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, coalesce($21, now()), $22, $23, $24, $25, $26, $27::jsonb, $28::jsonb)
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
      JSON.stringify(order.printOptions || {}),
      order.selectedPageCount ?? null,
      order.printablePageCount ?? null,
      order.sheetCount ?? null,
      order.amount,
      order.totalAmountPaise ?? Math.round(Number(order.amount || 0) * 100),
      order.paymentStatus,
      order.status,
      order.pickupCode,
      order.createdAt || null,
      order.customerType || 'registered',
      order.expiresAt || null,
      order.guestToken || null,
      order.guestName || null,
      order.guestPhone || null,
      order.priceSnapshot ? JSON.stringify(order.priceSnapshot) : null,
      order.printConfigSnapshot ? JSON.stringify(order.printConfigSnapshot) : null
    ]
  );

  return mapOrder(result.rows[0]);
}

export async function createOrderFile(orderFile, client) {
  const result = await executor(client).query(
    `insert into print_order_files (
       id,
       order_id,
       document_id,
       original_page_count,
       selected_pages,
       selected_page_count,
       printable_page_count,
       sheet_count,
      copies,
      print_options,
      line_amount_paise,
      created_at,
      print_sequence
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, coalesce($12, now()), $13)
     returning *`,
    [
      orderFile.id,
      orderFile.orderId,
      orderFile.documentId,
      orderFile.originalPageCount,
      orderFile.selectedPages || 'all',
      orderFile.selectedPageCount,
      orderFile.printablePageCount,
      orderFile.sheetCount,
      orderFile.copies,
      JSON.stringify(orderFile.printOptions || {}),
      orderFile.lineAmountPaise,
      orderFile.createdAt || null,
      orderFile.printSequence || 1
    ]
  );

  return mapOrderFile(result.rows[0]);
}

export async function listOrderFiles(orderId, client) {
  const result = await executor(client).query(
    `select
       pof.*,
       coalesce(pof.print_sequence, row_number() over (partition by pof.order_id order by pof.created_at, pof.id)) as print_sequence,
       d.file_name,
       d.file_type,
       d.file_size,
       d.file_size_bytes,
       d.file_sha256,
       d.storage_path,
       d.page_count,
       d.created_at as document_created_at
     from print_order_files pof
     join documents d on d.id = pof.document_id
     where pof.order_id = $1
     order by coalesce(pof.print_sequence, 999999), pof.created_at, pof.id`,
    [orderId]
  );

  return result.rows.map(mapOrderFile);
}

export async function findDocumentAccessContext(documentId, user, client) {
  const result = await executor(client).query(
    `select
       pof.*,
       po.user_id as order_user_id,
       po.hub_id,
       po.order_code,
       d.file_name,
       d.file_type,
       d.file_size,
       d.file_size_bytes,
       d.file_url,
       d.file_sha256,
       d.storage_path,
       d.page_count,
       d.created_at as document_created_at
     from print_order_files pof
     join print_orders po on po.id = pof.order_id
     join documents d on d.id = pof.document_id
     where pof.document_id = $1
     order by pof.created_at desc
     limit 1`,
    [documentId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const isAdmin = user?.role === 'admin';
  const isOwner = user?.role === 'user' && row.order_user_id === user.id;
  const isHubOwner = user?.role === 'hub' && row.hub_id === (user.centreId || user.hubId);

  return {
    allowed: Boolean(isAdmin || isOwner || isHubOwner),
    orderId: row.order_id,
    hubId: row.hub_id,
    orderCode: row.order_code,
    orderUserId: row.order_user_id,
    orderFile: mapOrderFile(row),
    document: {
      id: row.document_id,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSize: row.file_size_bytes === null || row.file_size_bytes === undefined ? row.file_size : Number(row.file_size_bytes),
      fileSizeBytes: row.file_size_bytes === null || row.file_size_bytes === undefined ? row.file_size : Number(row.file_size_bytes),
      fileUrl: row.file_url,
      fileSha256: row.file_sha256,
      storagePath: row.storage_path,
      pageCount: row.page_count === null || row.page_count === undefined ? null : Number(row.page_count),
      createdAt: timestamp(row.document_created_at)
    }
  };
}

export async function createDocumentAccessLog(access, client) {
  const result = await executor(client).query(
    `insert into document_access_logs (
       id, document_id, order_id, user_id, action, ip_address, user_agent, created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, now())
     returning *`,
    [
      access.id,
      access.documentId,
      access.orderId || null,
      access.userId || null,
      access.action,
      access.ipAddress || null,
      access.userAgent || null
    ]
  );

  return result.rows[0];
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
  const result = await query(
    `select *, hub_id as centre_id
     from print_orders
     where user_id = $1
     order by created_at desc`,
    [userId]
  );
  return result.rows.map(mapOrder);
}

export async function getUserPrintHistory(userId) {
  const ordersResult = await query(
    `select
       po.*,
       po.hub_id as centre_id,
       h.hub_name,
       h.hub_name as centre_name,
       h.centre_code,
       h.mobile as centre_mobile,
       h.upi_id as centre_upi_id,
       h.upi_qr_image_url as centre_upi_qr_image_url
     from print_orders po
     left join print_hubs h on h.id = po.hub_id
     where po.user_id = $1
       and coalesce(po.customer_type, 'registered') <> 'guest'
     order by po.created_at desc`,
    [userId]
  );

  const orders = ordersResult.rows.map((row) => ({
    ...mapOrder(row),
    hub: {
      id: row.hub_id,
      name: row.hub_name || row.centre_name || 'Print Hub',
      code: row.centre_code || null,
      mobile: row.centre_mobile || null,
      upiId: row.centre_upi_id || null,
      upiQrImageUrl: row.centre_upi_qr_image_url || null,
      address: null
    }
  }));

  const orderIds = orders.map((order) => order.id);
  if (!orderIds.length) {
    return { orders: [], filesByOrderId: new Map(), paymentsByOrderId: new Map(), printJobsByOrderId: new Map() };
  }

  const filesResult = await query(
    `select
       pof.*,
       coalesce(pof.print_sequence, row_number() over (partition by pof.order_id order by pof.created_at, pof.id)) as print_sequence,
       d.file_name,
       d.file_type,
       d.file_size,
       d.file_size_bytes,
       d.file_sha256,
       d.storage_path,
       d.page_count,
       d.created_at as document_created_at
     from print_order_files pof
     join documents d on d.id = pof.document_id
     where pof.order_id = any($1::text[])
     order by pof.order_id, coalesce(pof.print_sequence, 999999), pof.created_at, pof.id`,
    [orderIds]
  );

  const paymentsResult = await query(
    `select distinct on (order_id) *
     from payments
     where order_id = any($1::text[])
     order by order_id, coalesce(verified_at, created_at) desc, created_at desc`,
    [orderIds]
  );

  const printJobsResult = await query(
    `select *
     from print_jobs
     where order_id = any($1::text[])
     order by order_id, created_at desc`,
    [orderIds]
  );

  const filesByOrderId = new Map();
  for (const row of filesResult.rows) {
    const file = mapOrderFile(row);
    const list = filesByOrderId.get(file.orderId) || [];
    list.push(file);
    filesByOrderId.set(file.orderId, list);
  }

  const paymentsByOrderId = new Map();
  for (const row of paymentsResult.rows) {
    const payment = mapPayment(row);
    paymentsByOrderId.set(payment.orderId, payment);
  }

  const printJobsByOrderId = new Map();
  for (const row of printJobsResult.rows) {
    const printJob = mapPrintJob(row);
    const list = printJobsByOrderId.get(printJob.orderId) || [];
    list.push(printJob);
    printJobsByOrderId.set(printJob.orderId, list);
  }

  return { orders, filesByOrderId, paymentsByOrderId, printJobsByOrderId };
}

export async function listOrdersByCentre(centreId) {
  const result = await query(
    `select
       po.*,
       po.hub_id as centre_id,
       u.name as customer_name,
       u.mobile as customer_mobile
     from print_orders po
     left join users u on u.id = po.user_id
     where po.hub_id = $1
       and (po.expires_at is null or po.expires_at > now() or po.payment_status in ('collected', 'verified', 'paid'))
     order by po.created_at desc`,
    [centreId]
  );
  return result.rows.map(mapOrder);
}

export async function updateOrderStatus(orderId, centreId, status, client) {
  const result = await executor(client).query(
    'update print_orders set status = coalesce($3, status) where id = $1 and hub_id = $2 returning *, hub_id as centre_id',
    [orderId, centreId, status]
  );
  return mapOrder(result.rows[0]);
}

export async function cancelActivePrintJobsForOrder(orderId, hubId, reasonText = 'Order was stopped by hub owner', client) {
  const result = await executor(client).query(
    `update print_jobs
     set status = 'cancelled',
         failure_reason_code = coalesce(failure_reason_code, 'ORDER_CANCELLED'),
         failure_reason_text = coalesce($3, failure_reason_text),
         failed_at = coalesce(failed_at, now())
     where order_id = $1
       and hub_id = $2
       and status in ('queued', 'assigned', 'accepted', 'downloading', 'printing')
     returning *`,
    [orderId, hubId, reasonText]
  );

  return result.rows.map(mapPrintJob);
}

export async function updateOrderPayment(orderId, paymentStatus, status, client) {
  const result = await executor(client).query(
    'update print_orders set payment_status = $2, status = $3 where id = $1 returning *, hub_id as centre_id',
    [orderId, paymentStatus, status]
  );
  return mapOrder(result.rows[0]);
}

export async function createPayment(payment, client) {
  const result = await executor(client).query(
    `insert into payments (
       id, order_id, amount, method, transaction_id, status, created_at, verified_at,
       provider, provider_order_id, provider_payment_id, provider_signature,
       provider_status, provider_payload, payment_link_id, qr_code_id, qr_image_url, short_url
     )
     values (
       $1, $2, $3, $4, $5, $6, coalesce($7, now()), $8,
       $9, $10, $11, $12,
       $13, coalesce($14::jsonb, '{}'::jsonb), $15, $16, $17, $18
     )
     returning *`,
    [
      payment.id,
      payment.orderId,
      payment.amount,
      payment.method || payment.gateway || 'RAZORPAY',
      payment.transactionId || payment.gatewayPaymentId || payment.gatewayOrderId || null,
      payment.status,
      payment.createdAt || null,
      payment.verifiedAt || null,
      payment.provider || null,
      payment.providerOrderId || payment.gatewayOrderId || null,
      payment.providerPaymentId || payment.gatewayPaymentId || null,
      payment.providerSignature || null,
      payment.providerStatus || null,
      payment.providerPayload ? JSON.stringify(payment.providerPayload) : null,
      payment.paymentLinkId || null,
      payment.qrCodeId || null,
      payment.qrImageUrl || null,
      payment.shortUrl || null
    ]
  );

  return mapPayment(result.rows[0]);
}

export async function findPaymentById(id, client) {
  const result = await executor(client).query('select * from payments where id = $1', [id]);
  return mapPayment(result.rows[0]);
}

export async function findPaymentByProviderOrderId(providerOrderId, client) {
  const result = await executor(client).query(
    'select * from payments where provider_order_id = $1 order by created_at desc limit 1',
    [providerOrderId]
  );
  return mapPayment(result.rows[0]);
}

export async function findPaymentByProviderPaymentId(providerPaymentId, client) {
  const result = await executor(client).query(
    'select * from payments where provider_payment_id = $1 order by created_at desc limit 1',
    [providerPaymentId]
  );
  return mapPayment(result.rows[0]);
}

export async function updatePayment(paymentId, updates, client) {
  const result = await executor(client).query(
    `update payments
     set
       transaction_id = coalesce($2, transaction_id),
       status = coalesce($3, status),
       verified_at = coalesce($4, verified_at),
       provider_payment_id = coalesce($5, provider_payment_id),
       provider_signature = coalesce($6, provider_signature),
       provider_status = coalesce($7, provider_status),
       provider_payload = case
         when $8::jsonb is null then provider_payload
         else provider_payload || $8::jsonb
       end,
       payment_link_id = coalesce($9, payment_link_id),
       qr_code_id = coalesce($10, qr_code_id),
       qr_image_url = coalesce($11, qr_image_url),
       short_url = coalesce($12, short_url)
     where id = $1
     returning *`,
    [
      paymentId,
      updates.transactionId || updates.gatewayPaymentId || updates.providerPaymentId || null,
      updates.status || null,
      updates.verifiedAt || null,
      updates.providerPaymentId || updates.gatewayPaymentId || null,
      updates.providerSignature || null,
      updates.providerStatus || null,
      updates.providerPayload ? JSON.stringify(updates.providerPayload) : null,
      updates.paymentLinkId || null,
      updates.qrCodeId || null,
      updates.qrImageUrl || null,
      updates.shortUrl || null
    ]
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
       id, pairing_code_hash, approval_token_hash, public_key,
       device_id, agent_name, platform, version, status,
       expires_at, approval_expires_at, created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, coalesce($11, now()))
     returning *`,
    [
      session.id,
      session.pairingCodeHash,
      session.approvalTokenHash || null,
      session.publicKey || null,
      session.deviceId,
      session.agentName,
      session.platform || null,
      session.version || null,
      session.expiresAt,
      session.approvalExpiresAt || session.expiresAt,
      session.createdAt || null
    ]
  );

  return mapPairingSession(result.rows[0]);
}

export async function findPendingPairingSessionByCodeHash(pairingCodeHash, client) {
  const lockClause = client ? ' for update' : '';
  const result = await executor(client).query(
    `select *
     from agent_pairing_sessions
     where pairing_code_hash = $1
       and status = 'pending'
       and expires_at > now()
     order by created_at desc
     limit 1${lockClause}`,
    [pairingCodeHash]
  );

  return mapPairingSession(result.rows[0]);
}

export async function findPendingApprovalPairingSessionById(sessionId, client) {
  const lockClause = client ? ' for update' : '';
  const result = await executor(client).query(
    `select *
     from agent_pairing_sessions
     where id = $1
       and status = 'pending'
       and coalesce(approval_expires_at, expires_at) > now()
       and approval_token_hash is not null
     limit 1${lockClause}`,
    [sessionId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function findPairingSessionById(sessionId, client) {
  const result = await executor(client).query(
    'select * from agent_pairing_sessions where id = $1',
    [sessionId]
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

export async function approvePairingSession(sessionId, hubId, agentId, client) {
  const result = await executor(client).query(
    `update agent_pairing_sessions
     set status = 'claimed',
         hub_id = $2,
         agent_id = $3,
         claimed_at = now(),
         approved_at = now()
     where id = $1
       and status = 'pending'
       and coalesce(approval_expires_at, expires_at) > now()
     returning *`,
    [sessionId, hubId, agentId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function rejectPairingSession(sessionId, hubId, client) {
  const result = await executor(client).query(
    `update agent_pairing_sessions
     set status = 'rejected',
         hub_id = $2,
         rejected_at = now()
     where id = $1
       and status = 'pending'
       and coalesce(approval_expires_at, expires_at) > now()
     returning *`,
    [sessionId, hubId]
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

export async function listAllAgentsByHub(hubId, client) {
  const result = await executor(client).query(
    `select *
     from agents
     where hub_id = $1
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
        printer.status || printer.condition || 'unknown',
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

export async function findOrderWithDocumentForHub(orderId, hubId, client) {
  const result = await executor(client).query(
    `select
       po.*,
       po.hub_id as centre_id,
       d.id as document_id,
       d.file_url as document_file_url,
       d.file_sha256 as document_file_sha256,
       d.file_type as document_file_type,
       d.storage_path as document_storage_path,
       d.page_count as document_page_count
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

export async function findBestAgentForHub(hubId, client) {
  const result = await executor(client).query(
    `select *
     from agents a
     where a.hub_id = $1
       and a.revoked_at is null
       and a.paused = false
     order by
       case when a.last_seen_at >= now() - interval '45 seconds' then 0 else 1 end asc,
       a.last_seen_at desc nulls last,
       a.created_at desc
     limit 1`,
    [hubId]
  );

  const row = result.rows[0];
  return row ? mapAgent(row) : null;
}

export async function findPreferredPrinterHintForAgent(agentId, client) {
  const result = await executor(client).query(
    `select printer_name
     from agent_printers
     where agent_id = $1
     order by is_default desc nulls last, last_checked_at desc nulls last, created_at desc
     limit 1`,
    [agentId]
  );

  return result.rows[0]?.printer_name || null;
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
       d.storage_path as document_storage_path,
       d.page_count as document_page_count
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
      storagePath: row.document_storage_path || null,
      pageCount: row.document_page_count === null || row.document_page_count === undefined
        ? null
        : Number(row.document_page_count)
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
           and lower(coalesce(d.file_type, '')) = 'application/pdf'
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

export async function upsertPlatformVisit(sessionId, isPageView, client) {
  const pageViewIncrement = isPageView ? 1 : 0;
  
  await executor(client).query(
    `insert into platform_visits (session_id, created_at, last_active_at, page_views)
     values ($1, now(), now(), $2)
     on conflict (session_id) do update 
     set last_active_at = now(),
         page_views = platform_visits.page_views + $2`,
    [sessionId, pageViewIncrement]
  );
}

export async function getGlobalPlatformStats(client) {
  // Total orders, pages, revenue
  const ordersResult = await executor(client).query(
    `select 
       count(id) as total_orders,
       sum(pages * copies) as total_pages,
       sum(amount) as total_revenue
     from print_orders 
     where status in ('printed', 'completed')`
  );

  // Total print hubs (printers)
  const hubsResult = await executor(client).query(
    `select count(id) as total_printers from print_hubs`
  );

  // Visits and live users
  const visitsResult = await executor(client).query(
    `select 
       count(*) as total_visits,
       sum(coalesce(page_views, 1)) as total_page_views,
       sum(extract(epoch from (last_active_at - created_at))) as total_seconds_spent,
       count(case when last_active_at > now() - interval '5 minutes' then 1 end) as live_users,
       count(case when created_at >= date_trunc('day', now()) then 1 end) as visits_today,
       count(case when created_at >= date_trunc('month', now()) then 1 end) as visits_this_month
     from platform_visits`
  );

  // Registered Users
  const usersResult = await executor(client).query(
    `select count(id) as total_users from users`
  );

  const orders = ordersResult.rows[0];
  const hubs = hubsResult.rows[0];
  const visits = visitsResult.rows[0];
  const users = usersResult.rows[0];

  return {
    totalOrders: parseInt(orders.total_orders || 0, 10),
    totalPages: parseInt(orders.total_pages || 0, 10),
    totalRevenue: parseFloat(orders.total_revenue || 0),
    totalPrinters: parseInt(hubs.total_printers || 0, 10),
    totalVisits: parseInt(visits.total_visits || 0, 10),
    totalPageViews: parseInt(visits.total_page_views || 0, 10),
    totalSecondsSpent: parseInt(visits.total_seconds_spent || 0, 10),
    liveUsers: parseInt(visits.live_users || 0, 10),
    visitsToday: parseInt(visits.visits_today || 0, 10),
    visitsThisMonth: parseInt(visits.visits_this_month || 0, 10),
    registeredUsers: parseInt(users.total_users || 0, 10)
  };
}

export async function updateUserProfile(userId, updates, client) {
  const result = await executor(client).query(
    `update users
     set name = coalesce($2, name),
         username = coalesce($3, username),
         display_handle = coalesce($4, display_handle),
         mobile = coalesce($5, mobile)
     where id = $1
     returning *`,
    [userId, updates.name, updates.username, updates.displayHandle, updates.mobile]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function updateCentreProfile(ownerId, updates, client) {
  const result = await executor(client).query(
    `update print_hubs
     set hub_name = coalesce($2, hub_name),
         centre_code = coalesce($3, centre_code)
     where owner_id = $1
     returning *`,
    [ownerId, updates.hubName, updates.centreCode]
  );
  return result.rows[0] ? mapCentre(result.rows[0]) : null;
}

export async function deleteCentreByOwner(ownerId, client) {
  await executor(client).query(
    `delete from print_hubs where owner_id = $1`,
    [ownerId]
  );
}
