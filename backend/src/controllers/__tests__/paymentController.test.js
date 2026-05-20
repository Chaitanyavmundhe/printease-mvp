import { test, expect } from 'vitest';
import * as controller from '../paymentController.js';

test('payment controller exports expected handlers', () => {
  expect(typeof controller.getPaymentConfig).toBe('function');
  expect(typeof controller.createRazorpayOrder).toBe('function');
  expect(typeof controller.verifyRazorpayPayment).toBe('function');
  expect(typeof controller.createRazorpayUpiQr).toBe('function');
  expect(typeof controller.razorpayWebhook).toBe('function');
  expect(typeof controller.verifyDemoPayment).toBe('function');
});
