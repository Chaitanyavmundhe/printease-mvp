import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect } from './common.js';

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

  const locationEnabled = Boolean(row.location_enabled);

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
    bwSingle: number(row.bw_single) ?? 1,
    bwDouble: number(row.bw_double) ?? 1.5,
    colorSingle: number(row.color_single) ?? 2,
    colorDouble: number(row.color_double) ?? 3,
    watermarkCharge: number(row.watermark_charge) ?? 2,
    printerOnline: Boolean(row.printer_online),
    locationEnabled,
    latitude: locationEnabled ? (row.latitude === null || row.latitude === undefined ? null : Number(row.latitude)) : null,
    longitude: locationEnabled ? (row.longitude === null || row.longitude === undefined ? null : Number(row.longitude)) : null,
    addressText: row.address_text || null,
    area: row.area || null,
    city: row.city || null,
    mapUpdatedAt: timestamp(row.map_updated_at),
    afterOrderSettings: row.after_order_settings || {},
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
    printReadyStoragePath: row.print_ready_storage_path || null,
    printReadySha256: row.print_ready_sha256 || null,
    conversionSource: row.conversion_source || null,
    conversionPlacement: row.conversion_placement || null,
    conversionReasonCode: row.conversion_reason_code || null,
    fileKind: row.file_kind,
    requiresDesktopPreparation: row.requires_desktop_preparation,
    preparedPageCount: row.prepared_page_count === null || row.prepared_page_count === undefined
      ? null
      : Number(row.prepared_page_count),
    preparationStatus: row.preparation_status,
    preparationErrorCode: row.preparation_error_code,
    preparationErrorMessage: row.preparation_error_message,
    preparedAt: row.prepared_at,
    pageCount: row.page_count === null || row.page_count === undefined ? null : Number(row.page_count),
    hubId: row.hub_id || null,
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
    guestTokenHash: row.guest_token_hash || null,
    guestName: row.guest_name || null,
    guestPhone: row.guest_phone || null,
    priceSnapshot: row.price_snapshot || null,
    printConfigSnapshot: row.print_config_snapshot || null,
    expiresAt: row.expires_at || null,
    paymentStatus: row.payment_status,
    billStatus: row.bill_status || null,
    status: row.status,
    pickupCode: row.pickup_code,
    configVersion: row.config_version !== undefined ? number(row.config_version) : 1,
    latestConfiguredByRole: row.latest_configured_by_role || null,
    latestConfiguredByUserId: row.latest_configured_by_user_id || null,
    latestConfiguredByHubId: row.latest_configured_by_hub_id || null,
    latestConfiguredAt: row.latest_configured_at ? timestamp(row.latest_configured_at) : null,
    latestConfigSource: row.latest_config_source || null,
    configLockedAt: row.config_locked_at ? timestamp(row.config_locked_at) : null,
    configLockReason: row.config_lock_reason || null,
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
          printReadyStoragePath: row.print_ready_storage_path || null,
          printReadySha256: row.print_ready_sha256 || null,
          conversionSource: row.conversion_source || null,
          conversionPlacement: row.conversion_placement || null,
          conversionReasonCode: row.conversion_reason_code || null,
          fileKind: row.file_kind || null,
          requiresDesktopPreparation: Boolean(row.requires_desktop_preparation),
          pageCount: row.page_count === null || row.page_count === undefined ? null : Number(row.page_count),
          preparedPageCount: row.prepared_page_count === null || row.prepared_page_count === undefined ? null : Number(row.prepared_page_count),
          preparationStatus: row.preparation_status || 'prepared',
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
