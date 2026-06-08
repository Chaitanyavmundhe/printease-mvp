export const ALLOWED_HUB_ORDER_STATUSES = new Set([
  'Payment Pending',
  'Payment Verified',
  'Payment Collected',
  'Accepted by Centre',
  'Queued for Printing',
  'Sent to Agent',
  'Printing',
  'Ready for Pickup',
  'Collected',
  'Paused',
  'Cancelled',
  'Printing Failed',
  'Refund Requested'
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

export function canAccessOrder(user, order, req = null) {
  if (!order) return false;

  if (user?.role === 'admin') return true;
  if (user?.role === 'hub' && order.centreId === (user.centreId || user.hubId)) return true;
  if (user?.role === 'user' && order.userId === user.id) return true;

  if (!order.userId) {
    const providedToken = req ? getOrderAccessToken(req) : '';
    return Boolean(providedToken && order.guestToken && providedToken === order.guestToken);
  }

  return false;
}
