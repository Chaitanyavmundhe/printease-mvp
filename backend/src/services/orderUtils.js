import { hashGuestToken } from './guestAccessService.js';

export const ALLOWED_HUB_ORDER_STATUSES = new Set([
  'draft_uploaded',
  'payment_requested',
  'payment_collected',
  'queued_for_print',
  'printing',
  'completed',
  'failed',
  'cancelled'
]);

export function normalizePaymentStatus(order) {
  return String(order?.paymentStatus || '').trim().toLowerCase();
}

export function normalizeOrderStatus(order) {
  return String(order?.status || '').trim().toLowerCase();
}

export function isCancelledOrder(order) {
  return normalizeOrderStatus(order) === 'cancelled';
}

export function isPaymentComplete(order) {
  return ['verified', 'collected', 'paid'].includes(normalizePaymentStatus(order));
}

export function getOrderAccessToken(req) {
  return String(
    req?.headers?.['x-order-access-token']
      || req?.body?.orderAccessToken
      || req?.query?.token
      || ''
  ).trim();
}

/**
 * orderUtils.js
 * 
 * Shared helper functions for evaluating order state, access permissions,
 * and standard statuses. Extracted to prevent duplication across controllers.
 */

export function canAccessOrder(user, order, req = null) {
  if (!order) return false;

  if (user?.role === 'admin') return true;
  if (user?.role === 'hub' && order.centreId === (user.centreId || user.hubId)) return true;
  if (user?.role === 'user' && order.userId === user.id) return true;

  if (!order.userId) {
    const providedToken = req ? getOrderAccessToken(req) : '';
    if (!providedToken) return false;
    if (order.guestToken && providedToken === order.guestToken) return true;
    return Boolean(order.guestTokenHash && hashGuestToken(providedToken) === order.guestTokenHash);
  }

  return false;
}
