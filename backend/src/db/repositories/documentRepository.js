import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect } from './common.js';
import { mapDocument, mapOrderFile } from './mappers.js';

export async function updateDocumentHub(documentId, hubId, client) {
  const result = await executor(client).query(
    `update documents
     set hub_id = $2
     where id = $1
     returning *`,
    [documentId, hubId]
  );
  return mapDocument(result.rows[0]);
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
       print_ready_storage_path,
       print_ready_sha256,
       conversion_source,
       conversion_placement,
       conversion_reason_code,
       file_kind,
       requires_desktop_preparation,
       page_count,
       guest_token_hash,
       expires_at,
       created_at,
       prepared_page_count,
       preparation_status,
       preparation_error_code,
       preparation_error_message,
       prepared_at,
       hub_id
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, coalesce($20, now()), $21, $22, $23, $24, $25, $26)
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
      document.printReadyStoragePath || null,
      document.printReadySha256 || null,
      document.conversionSource || null,
      document.conversionPlacement || null,
      document.conversionReasonCode || null,
      document.fileKind || null,
      Boolean(document.requiresDesktopPreparation),
      document.pageCount || null,
      document.guestTokenHash || null,
      document.expiresAt || null,
      document.createdAt || null,
      document.preparedPageCount || null,
      document.preparationStatus || 'prepared',
      document.preparationErrorCode || null,
      document.preparationErrorMessage || null,
      document.preparedAt || null,
      document.hubId || null
    ]
  );

  return mapDocument(result.rows[0]);
}

export async function updateDocumentPreparation(id, data, client) {
  const result = await executor(client).query(
    `update documents
     set prepared_page_count = $2,
         preparation_status = $3,
         preparation_error_code = $4,
         preparation_error_message = $5,
         prepared_at = coalesce($6, now()),
         print_ready_storage_path = coalesce($7, print_ready_storage_path),
         print_ready_sha256 = coalesce($8, print_ready_sha256)
     where id = $1
     returning *`,
    [
      id,
      data.preparedPageCount,
      data.preparationStatus,
      data.preparationErrorCode || null,
      data.preparationErrorMessage || null,
      data.preparedAt || null,
      data.printReadyStoragePath || null,
      data.printReadySha256 || null
    ]
  );
  return result.rows.length ? mapDocument(result.rows[0]) : null;
}

export async function findDocumentById(documentId, client) {
  if (!isUuid(documentId)) return null;

  const result = await executor(client).query('select * from documents where id = $1', [documentId]);
  return mapDocument(result.rows[0]);
}

export async function findOrderIdsByDocumentId(documentId, client) {
  const result = await executor(client).query(
    `select order_id from print_order_files where document_id = $1`,
    [documentId]
  );
  return result.rows.map(r => r.order_id);
}

export async function findDocumentAccessContext(documentId, user, guestToken, client) {
  const result = await executor(client).query(
    `select
       pof.*,
       po.user_id as order_user_id,
       po.hub_id,
       po.order_code,
       po.guest_token,
       po.guest_token_hash,
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
  
  let isGuestOwner = false;
  if (!row.order_user_id && guestToken) {
    if (row.guest_token === guestToken) isGuestOwner = true;
    else if (row.guest_token_hash && typeof guestToken === 'string') {
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(guestToken).digest('hex');
      if (row.guest_token_hash === hash) isGuestOwner = true;
    }
  }

  return {
    allowed: Boolean(isAdmin || isOwner || isHubOwner || isGuestOwner),
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

export async function updateGuestDocumentsTokenHash(documentIds, guestTokenHash, expiresAt, client) {
  if (!documentIds || documentIds.length === 0) return;
  
  const placeholders = documentIds.map((_, i) => `$${i + 3}`).join(', ');
  const params = [guestTokenHash, expiresAt, ...documentIds];
  
  await executor(client).query(
    `UPDATE documents 
     SET guest_token_hash = $1, expires_at = $2 
     WHERE id IN (${placeholders}) AND user_id IS NULL`,
    params
  );
}
