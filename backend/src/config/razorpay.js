// Future Razorpay client placeholder.
// Install razorpay before using production payments.

export function getRazorpayConfigStatus() {
  return {
    keyIdConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
    keySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET)
  };
}
