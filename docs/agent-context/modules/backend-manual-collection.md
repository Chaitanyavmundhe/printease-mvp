# Module: backend-manual-collection

## Current files
- `backend/src/services/manualCollectionService.js`
- `backend/src/controllers/orderController.js`

## Responsibility
Collect offline payment for a hub-owned order and optionally queue a print job.

## Owns
- allowed manual collection methods
- payment row creation for cash/manual UPI
- collected payment status transition
- optional auto-queue trigger

## Does not own
- Razorpay verification
- PDF upload
- desktop OS printing

## Functions/components inside
- `processManualCollection`
- future pure `validateManualCollectionMethod`

## Inputs
- order ID
- hub ID
- method
- transaction note
- auto-print toggle

## Outputs
- payment object
- updated order
- optional queued print job

## Side effects
Writes `payments`, updates `print_orders`, may insert/find `print_jobs`.

## Dependencies
- repository transaction helpers
- `queuePrintJobIfPaymentReady`
- order status utility helpers

## Security rules
- method must be exactly `cash` or `manual_upi`
- hub must own order
- cancelled unpaid order cannot be collected

## Known risks
- invalid method accidentally treated as cash
- duplicate collection
- print queued when auto-print toggle is off

## Safe to edit
Only for offline payment collection behavior.

## Do not edit
Do not edit for Razorpay, upload, or desktop command execution.

## Related contracts
- `contracts/manual-collection-contract.md`

## Related flows
- `flows/manual-collection-flow.md`
