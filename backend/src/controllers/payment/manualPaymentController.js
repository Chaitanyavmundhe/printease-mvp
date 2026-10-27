import { requestManualPayment } from '../../services/manualPaymentRequestService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getPaymentConfig = asyncHandler(async (_req, res) => {
  res.json({ success: true, methods: ['manual'], onlinePaymentsEnabled: false });
});

export const createManualPaymentRequest = asyncHandler(async (req, res) => {
  if (!req.body?.orderId) {
    return res.status(400).json({ success: false, message: 'Order ID is required' });
  }

  // Intent only, never collection: ownership, verified pricing and duplicate
  // protection remain in the locked service. Only the hub can confirm receipt.
  const result = await requestManualPayment(req);
  res.status(201).json({ success: true, message: 'Pending payment request created.', ...result });
});
