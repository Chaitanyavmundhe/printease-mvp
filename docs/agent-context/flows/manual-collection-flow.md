# Manual Collection Flow

## Purpose
Allow a hub owner to mark an order as paid through offline cash or manual UPI, then optionally queue the order for desktop printing.

## Actors
- Hub owner
- Backend
- Desktop agent, only if auto-queue is enabled

## Entry points
- `PATCH /api/orders/:id/collect-cash`
- frontend hub dashboard cash/manual collection action

## Input
- `orderId`
- authenticated hub user with `centreId`/`hubId`
- `method`: exact `cash` or `manual_upi`
- optional `transactionNote`
- optional `autoPrintAfterCollection`

## Output
- `payment` row with `method` of `CASH` or `MANUAL_UPI`
- `print_orders.payment_status = collected`
- optional queued `print_jobs` row

## Source of truth
- `print_orders`
- `payments`
- `print_jobs`

## State changes
- pending/unpaid order becomes payment collected
- payment record is created
- print job is queued only if `autoPrintAfterCollection !== false` and print readiness checks pass

## Micro-components used
- `processManualCollection`
- `queuePrintJobIfPaymentReady`
- `verifyPrintFilesReadiness`

## Files involved
- `backend/src/controllers/orderController.js`
- `backend/src/services/manualCollectionService.js`
- `backend/src/services/printQueueService.js`
- `backend/src/services/printJobReadinessService.js`
- `backend/src/db/repository.js`

## Security rules
- Do not accept arbitrary method strings.
- Do not collect payment for an order outside the hub.
- Do not collect cancelled unpaid orders.
- Do not queue printing unless payment is collected/verified and files are private, hashed PDFs.

## Known risks
- Treating invalid methods as cash.
- Queueing unpaid or cancelled orders.
- Duplicate collection creating multiple payments.
- Auto-printing when hub intended manual print.

## Tiny tasks
- Extract `validateManualCollectionMethod(rawMethod)` as a pure exported helper.
- Add focused tests for invalid method, cash, manual_upi, cancelled unpaid order, idempotent duplicate collection.

## Tests
- Backend unit/integration test for `PATCH /api/orders/:id/collect-cash`.
- Verify hub A cannot collect hub B order.
- Verify `autoPrintAfterCollection: false` does not queue.
