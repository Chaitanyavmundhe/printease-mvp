export const PAYMENT_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  VERIFIED: 'verified',
  COLLECTED: 'collected',
  FAILED: 'failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

export const PRINT_JOB_STATUSES = Object.freeze({
  QUEUED: 'queued',
  ASSIGNED: 'assigned', // Note: backend uses this status when assigned to an agent
  ACCEPTED: 'accepted',
  DOWNLOADING: 'downloading',
  PRINTING: 'printing',
  SUBMITTED_TO_PRINTER: 'submitted_to_printer',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

export const AGENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  ONLINE: 'online',
  OFFLINE: 'offline',
  PAUSED: 'paused',
  REVOKED: 'revoked',
  ERROR: 'error',
  UNKNOWN: 'unknown',
});

export const PAIRING_STATUSES = Object.freeze({
  PENDING: 'pending',
  CLAIMED: 'claimed',
  CONFIRMED: 'confirmed', // Note: DB constraint Phase 6 specified 'approved', but code uses 'confirmed'
  REJECTED: 'rejected',
  EXPIRED: 'expired',
});

export const AGENT_PRINTER_STATUSES = Object.freeze({
  UNKNOWN: 'unknown',
  AVAILABLE: 'available',
  BUSY: 'busy',
  ERROR: 'error',
  OFFLINE: 'offline',
});
