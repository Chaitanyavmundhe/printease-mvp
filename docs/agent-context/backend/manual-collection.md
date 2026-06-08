# MANUAL COLLECTION

## File paths
- `backend/src/controllers/orderController.js` (see `collectCashPayment` function)

## Responsibility
Handle the manual collection of payments at the Hub (Cash or Manual UPI), bypassing Razorpay.

## Owns
- Payment creation for manual methods
- Updating order status to collected

## Does not own
- Razorpay verification

## Important functions
- `collectCashPayment`

## Inputs
- `method`: MUST be exact string `'cash'` or `'manual_upi'`.
- `transactionNote`: String up to 200 chars.
- `autoPrintAfterCollection`: Boolean.

## Outputs
- Payment object
- Updated Order object
- PrintJob object (if auto-queued)

## Side effects
- Order status changes to `collected`.
- Payment record created in DB.
- Print job queued if `autoPrintAfterCollection` is true.

## API/database calls
- `withTransaction`
- `findOrderByIdOrCode`
- `savePayment`
- `updateOrderPayment`
- `queuePrintJobIfPaymentReady`

## Security rules
- Validates method strictly against `cash` or `manual_upi`.
- Validates user has access to order's hub.
- Validates order is not cancelled before payment.

## Known risks
- Manual payment depends on Hub operator honesty.

## Reusable helper extraction ideas
- Move `collectCashPayment` into a `manualCollectionService`.

## Safe to edit
Yes, with care to maintain strict method validation.

## Do not edit
- The strict method validation logic.

## Related flow docs
- `manual-collection-flow.md`

## Related contract docs
- `manual-collection-contract.md`
