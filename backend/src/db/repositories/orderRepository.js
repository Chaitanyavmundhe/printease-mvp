import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect } from './common.js';

export async function createOrder(order, client) {
  const result = await executor(client).query(
      `insert into print_orders (
         id, order_code, user_id, hub_id, document_name, document_url, pages, copies,
         color_type, side_type, watermark_enabled, print_options, selected_page_count,
         printable_page_count, sheet_count, amount, total_amount_paise, payment_status,
         status, pickup_code, created_at, customer_type, expires_at,
         guest_token, guest_name, guest_phone, price_snapshot, print_config_snapshot,
         guest_token_hash
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, coalesce($21, now()), $22, $23, $24, $25, $26, $27::jsonb, $28::jsonb, $29)
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
      order.printConfigSnapshot ? JSON.stringify(order.printConfigSnapshot) : null,
      order.guestTokenHash || null
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
       d.print_ready_storage_path,
       d.print_ready_sha256,
       d.conversion_source,
       d.conversion_placement,
       d.conversion_reason_code,
       d.file_kind,
       d.requires_desktop_preparation,
       d.page_count,
       d.prepared_page_count,
       d.preparation_status,
       d.created_at as document_created_at
     from print_order_files pof
     join documents d on d.id = pof.document_id
     where pof.order_id = $1
     order by coalesce(pof.print_sequence, 999999), pof.created_at, pof.id`,
    [orderId]
  );

  return result.rows.map(mapOrderFile);
}

export async function listPendingPaymentOrderFilesForAgentPredownload(hubId, { limit = 20 } = {}, client) {
  const boundedLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const result = await executor(client).query(
    `select
       pof.*,
       coalesce(pof.print_sequence, row_number() over (partition by pof.order_id order by pof.created_at, pof.id)) as print_sequence,
       po.order_code,
       po.pickup_code,
       po.payment_status,
       po.status as order_status,
       d.file_name,
       d.file_type,
       d.file_size,
       d.file_size_bytes,
       d.file_sha256,
       d.storage_path,
       d.print_ready_storage_path,
       d.print_ready_sha256,
       d.conversion_source,
       d.conversion_placement,
       d.conversion_reason_code,
       d.file_kind,
       d.requires_desktop_preparation,
       d.page_count,
       d.prepared_page_count,
       d.preparation_status,
       d.created_at as document_created_at
     from print_orders po
     join print_order_files pof on pof.order_id = po.id
     join documents d on d.id = pof.document_id
     where po.hub_id = $1
       and lower(coalesce(po.payment_status, '')) in ('draft', 'pending', 'not_requested', 'requested', 'failed')
       and po.status not in (
         'cancelled',
         'completed'
       )
       and (po.expires_at is null or po.expires_at > now())
       and d.storage_path is not null
       and d.storage_path <> ''
       and d.file_sha256 is not null
       and d.file_sha256 <> ''
       and lower(coalesce(d.file_type, '')) in (
         'application/pdf',
         'image/jpeg',
         'image/png',
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
       and not exists (
         select 1
         from print_jobs pj
         where pj.order_id = po.id
           and pj.hub_id = po.hub_id
           and pj.status in ('queued', 'assigned', 'accepted', 'downloading', 'printing')
       )
     order by po.created_at desc, coalesce(pof.print_sequence, 999999), pof.created_at, pof.id
     limit $2`,
    [hubId, boundedLimit]
  );

  return result.rows.map((row) => ({
    orderId: row.order_id,
    orderCode: row.order_code || null,
    pickupCode: row.pickup_code || null,
    paymentStatus: row.payment_status || null,
    orderStatus: row.order_status || null,
    file: mapOrderFile(row),
  }));
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
     where pof.order_id = any($1::uuid[])
     order by pof.order_id, coalesce(pof.print_sequence, 999999), pof.created_at, pof.id`,
    [orderIds]
  );

  const paymentsResult = await query(
    `select distinct on (order_id) *
     from payments
     where order_id = any($1::uuid[])
     order by order_id, coalesce(verified_at, created_at) desc, created_at desc`,
    [orderIds]
  );

  const printJobsResult = await query(
    `select *
     from print_jobs
     where order_id = any($1::uuid[])
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

export async function getUserPrintHistoryCompact(userId, limit = 20) {
  const ordersResult = await query(
    `select
       po.id,
       po.order_code,
       po.created_at,
       po.status,
       po.payment_status,
       po.amount,
       po.pages,
       po.copies,
       po.document_name,
       po.printable_page_count,
       po.selected_page_count,
       po.hub_id,
       h.hub_name,
       h.centre_code,
       coalesce(fc.file_count, 1) as file_count
     from print_orders po
     left join print_hubs h on h.id = po.hub_id
     left join (
       select order_id, count(*)::int as file_count
       from print_order_files
       group by order_id
     ) fc on fc.order_id = po.id
     where po.user_id = $1
       and coalesce(po.customer_type, 'registered') <> 'guest'
     order by po.created_at desc
     limit $2`,
    [userId, limit]
  );

  return ordersResult.rows.map((row) => ({
    id: row.id,
    order_code: row.order_code,
    created_at: timestamp(row.created_at),
    status: row.status,
    payment_status: row.payment_status,
    amount: number(row.amount),
    pages: row.pages,
    copies: row.copies,
    document_name: row.document_name || null,
    printable_page_count: row.printable_page_count === null || row.printable_page_count === undefined
      ? null
      : Number(row.printable_page_count),
    selected_page_count: row.selected_page_count === null || row.selected_page_count === undefined
      ? null
      : Number(row.selected_page_count),
    file_count: Number(row.file_count || 1),
    hub: {
      id: row.hub_id,
      name: row.hub_name || 'Print Hub',
      code: row.centre_code || null
    }
  }));
}

export async function getOrderForUser(orderId, userId) {
  const orderResult = await query(
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
     where po.id = $1
       and po.user_id = $2
       and coalesce(po.customer_type, 'registered') <> 'guest'
     limit 1`,
    [orderId, userId]
  );

  const row = orderResult.rows[0];
  if (!row) return null;

  const order = {
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
  };

  const [filesResult, paymentsResult, printJobsResult] = await Promise.all([
    query(
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
    ),
    query(
      `select distinct on (order_id) *
       from payments
       where order_id = $1
       order by order_id, coalesce(verified_at, created_at) desc, created_at desc`,
      [orderId]
    ),
    query(
      `select *
       from print_jobs
       where order_id = $1
       order by created_at desc`,
      [orderId]
    )
  ]);

  return {
    order,
    files: filesResult.rows.map(mapOrderFile),
    payment: paymentsResult.rows[0] ? mapPayment(paymentsResult.rows[0]) : null,
    printJobs: printJobsResult.rows.map(mapPrintJob)
  };
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

export async function updateOrderConfiguration(orderId, updates, client) {
  const result = await executor(client).query(
    `update print_orders
     set config_version = config_version + 1,
         latest_configured_by_role = $2,
         latest_configured_by_user_id = $3,
         latest_configured_by_hub_id = $4,
         latest_configured_at = now(),
         latest_config_source = $5,
         print_config_snapshot = $6::jsonb,
         price_snapshot = $7::jsonb,
         total_amount_paise = $8,
         amount = $9,
         pages = $10,
         copies = $11,
         selected_page_count = $12,
         printable_page_count = $13,
         sheet_count = $14
     where id = $1
     returning *, hub_id as centre_id`,
    [
      orderId,
      updates.latestConfiguredByRole,
      updates.latestConfiguredByUserId || null,
      updates.latestConfiguredByHubId || null,
      updates.latestConfigSource,
      updates.printConfigSnapshot ? JSON.stringify(updates.printConfigSnapshot) : null,
      updates.priceSnapshot ? JSON.stringify(updates.priceSnapshot) : null,
      updates.totalAmountPaise,
      updates.amount,
      updates.pages || 0,
      updates.copies || 0,
      updates.selectedPageCount || 0,
      updates.printablePageCount || 0,
      updates.sheetCount || 0
    ]
  );
  return mapOrder(result.rows[0]);
}

export async function updateOrderFileConfiguration(orderFileId, updates, client) {
  const result = await executor(client).query(
    `update print_order_files
     set copies = $2,
         selected_pages = $3,
         selected_page_count = $4,
         printable_page_count = $5,
         sheet_count = $6,
         print_options = $7::jsonb,
         line_amount_paise = $8
     where id = $1
     returning *`,
    [
      orderFileId,
      updates.copies,
      updates.selectedPages,
      updates.selectedPageCount,
      updates.printablePageCount,
      updates.sheetCount,
      updates.printOptions ? JSON.stringify(updates.printOptions) : null,
      updates.lineAmountPaise
    ]
  );
  return mapOrderFile(result.rows[0]);
}

export async function createOrderConfigEvent(event, client) {
  const result = await executor(client).query(
    `insert into print_order_config_events (
       order_id, actor_role, actor_user_id, actor_hub_id, event_type,
       previous_config, new_config, previous_price_snapshot, new_price_snapshot,
       previous_amount_paise, new_amount_paise, note
     )
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12)
     returning *`,
    [
      event.orderId,
      event.actorRole,
      event.actorUserId || null,
      event.actorHubId || null,
      event.eventType,
      event.previousConfig ? JSON.stringify(event.previousConfig) : null,
      event.newConfig ? JSON.stringify(event.newConfig) : null,
      event.previousPriceSnapshot ? JSON.stringify(event.previousPriceSnapshot) : null,
      event.newPriceSnapshot ? JSON.stringify(event.newPriceSnapshot) : null,
      event.previousAmountPaise || null,
      event.newAmountPaise || null,
      event.note || null
    ]
  );
  return result.rows[0];
}

export async function getOrderConfigEvents(orderId, client) {
  const result = await executor(client).query(
    `select * from print_order_config_events
     where order_id = $1
     order by created_at asc`,
    [orderId]
  );
  return result.rows.map(row => ({
    id: row.id,
    orderId: row.order_id,
    actorRole: row.actor_role,
    actorUserId: row.actor_user_id,
    actorHubId: row.actor_hub_id,
    eventType: row.event_type,
    previousConfig: row.previous_config,
    newConfig: row.new_config,
    previousPriceSnapshot: row.previous_price_snapshot,
    newPriceSnapshot: row.new_price_snapshot,
    previousAmountPaise: row.previous_amount_paise,
    newAmountPaise: row.new_amount_paise,
    note: row.note,
    createdAt: timestamp(row.created_at)
  }));
}

export async function lockOrderConfiguration(orderId, reason, client) {
  const result = await executor(client).query(
    `update print_orders
     set config_locked_at = now(),
         config_lock_reason = $2
     where id = $1
     returning *, hub_id as centre_id`,
    [orderId, reason]
  );
  return mapOrder(result.rows[0]);
}

export async function listPendingBillVerificationJobsForAgent(hubId, { limit = 20 } = {}, client) {
  const boundedLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const result = await executor(client).query(
    `select
       pof.*,
       po.order_code,
       po.status as order_status,
       d.file_name,
       d.file_type,
       d.file_size,
       d.file_size_bytes,
       d.file_sha256,
       d.storage_path,
       d.print_ready_storage_path,
       d.print_ready_sha256,
       d.conversion_source,
       d.conversion_placement,
       d.conversion_reason_code,
       d.file_kind,
       d.requires_desktop_preparation,
       d.page_count,
       d.prepared_page_count,
       d.preparation_status,
       d.created_at as document_created_at
     from print_orders po
     join print_order_files pof on pof.order_id = po.id
     join documents d on d.id = pof.document_id
     where po.hub_id = $1
       and po.status = 'awaiting_hub_bill_confirmation'
       and (po.expires_at is null or po.expires_at > now())
       and d.storage_path is not null
       and d.storage_path <> ''
       and d.file_sha256 is not null
       and d.file_sha256 <> ''
     order by po.created_at asc, pof.id asc
     limit $2`,
    [hubId, boundedLimit]
  );

  return result.rows.map((row) => ({
    orderId: row.order_id,
    orderCode: row.order_code || null,
    orderStatus: row.order_status || null,
    file: mapOrderFile(row),
  }));
}
