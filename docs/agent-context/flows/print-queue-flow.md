# Print Queue Flow

## Purpose
Queue a paid/collected order for a desktop agent only when payment, order status, and every document file are printable.

## Actors
- Backend
- Hub owner
- Desktop agent

## Entry points
- manual collection auto-queue
- Razorpay verified payment
- hub Send to Agent action

## Input
- order ID
- hub ID
- collected/verified payment status
- linked document files

## Output
- existing active print job or new `print_jobs` row
- order status updated to queued/sent state

## Source of truth
- `print_orders`
- `print_order_files`
- `documents`
- `print_jobs`

## State changes
- `print_jobs` may be inserted
- `print_orders.status` may move toward queued/sent

## Micro-components used
- `queuePrintJobIfPaymentReady`
- `verifyPrintFilesReadiness`
- `isPrintableOrderStatus`

## Files involved
- `backend/src/services/printQueueService.js`
- `backend/src/services/printJobReadinessService.js`
- `backend/src/db/repository.js`

## Security rules
- never queue unpaid orders
- never queue cancelled/failed/paused orders
- require private storage path and SHA-256 for every file
- require PDF file type

## Known risks
- missing multi-file rows
- duplicate print jobs
- stale order status
- file without hash released to desktop

## Tiny tasks
- add focused tests for multi-file readiness
- add duplicate active job reuse test

## Tests
- collect manual payment with auto-print on
- verify one active print job exists
- verify unpaid/cancelled orders are not queued
