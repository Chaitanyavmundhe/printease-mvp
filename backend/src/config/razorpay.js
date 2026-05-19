import Razorpay from 'razorpay';

export function getRazorpayConfigStatus() {
  return {
    enabled: process.env.RAZORPAY_ENABLED === 'true',
    keyIdConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
    keySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET),
    webhookSecretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)
  };
}

export function isRazorpayEnabled() {
  return process.env.RAZORPAY_ENABLED === 'true';
}

export function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID;
}

export function getRazorpayWebhookSecret() {
  return process.env.RAZORPAY_WEBHOOK_SECRET;
}

export function getRazorpayKeySecret() {
  return process.env.RAZORPAY_KEY_SECRET;
}

export function getRazorpayClient() {
  if (!isRazorpayEnabled()) {
    throw new Error('Razorpay is disabled. Set RAZORPAY_ENABLED=true to use online payments.');
  }

  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();

  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured. Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET.');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}
