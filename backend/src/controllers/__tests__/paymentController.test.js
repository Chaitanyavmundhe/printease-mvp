import { test, expect } from 'vitest';
import * as controller from '../paymentController.js';

test('payment controller exports expected handlers', () => {
  expect(typeof controller.getPaymentConfig).toBe('function');
  expect(typeof controller.createManualPaymentRequest).toBe('function');
  expect(Object.keys(controller).sort()).toEqual(['createManualPaymentRequest', 'getPaymentConfig']);
});
