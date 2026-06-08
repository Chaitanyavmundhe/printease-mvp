# Module: backend-print-queue

## Current files
- `backend/src/services/printQueueService.js`
- `backend/src/services/printJobReadinessService.js`
- `backend/src/db/repository.js`

## Responsibility
Queue or reuse print jobs only after payment and document readiness checks pass.

## Owns
- payment-ready gate
- document storage/hash/PDF readiness gate
- print job creation/reuse

## Does not own
- manual payment collection UI
- Razorpay signature verification
- desktop local printing

## Functions/components inside
- `queuePrintJobIfPaymentReady`
- `verifyPrintFilesReadiness`
- `isPrintableOrderStatus`

## Inputs
- order ID
- hub ID
- database transaction client

## Outputs
- queued/reused print job result
- readiness/error message
- updated order status when queued

## Side effects
Can insert `print_jobs` and update `print_orders.status`.

## Dependencies
- repository order/file/job helpers
- `printJobReadinessService`

## Security rules
- payment must be collected/verified
- order must belong to hub
- all files must be private PDFs with hashes
- cancelled/paused/failed orders must not queue

## Known risks
- unpaid document released to desktop
- multi-file order missing files
- duplicate print job creation

## Safe to edit
Only when changing queueing/payment readiness behavior.

## Do not edit
Do not edit for UI-only order table changes.

## Related contracts
- `contracts/print-job-contract.md`
- `contracts/order-file-contract.md`

## Related flows
- `flows/print-queue-flow.md`
- `flows/hub-send-to-agent-flow.md`
