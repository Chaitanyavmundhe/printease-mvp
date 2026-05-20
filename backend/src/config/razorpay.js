import Razorpay from 'razorpay';

export const RAZORPAY_ENABLED = String(process.env.RAZORPAY_ENABLED || 'false').toLowerCase() === 'true';
export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
export const RAZORPAY_CURRENCY = process.env.RAZORPAY_CURRENCY || 'INR';

let cachedClient = null;

export function getRazorpayClient() {
  if (!RAZORPAY_ENABLED) {
    const error = new Error('Razorpay is not enabled.');
    error.statusCode = 503;
    throw error;
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    const error = new Error('Razorpay credentials are not configured.');
    error.statusCode = 500;
    throw error;
  }

  if (!cachedClient) {
    cachedClient = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET
    });
  }

  return cachedClient;
}

export function getPublicRazorpayConfig() {
  return {
    enabled: RAZORPAY_ENABLED,
    keyId: RAZORPAY_ENABLED ? RAZORPAY_KEY_ID : '',
    currency: RAZORPAY_CURRENCY
  };
}

export function amountToPaise(amount) {
  const paise = Math.round(Number(amount || 0) * 100);
  if (!Number.isFinite(paise) || paise <= 0) {
    throw new Error('Invalid payment amount.');
  }
  return paise;
}