# Component: check-payment-ready-for-print

## Size
Small

## Domain
Backend

## Flow
Print Queue

## Current File
`backend/src/services/printJobReadinessService.js`

## Future File
Already extracted.

## Purpose
Decide whether an order and its files are safe to release to the desktop print queue.

## Input
- order payment/status fields
- order files
- document storage path
- document SHA-256
- document MIME type

## Output
- `isReady`
- first printable file
- storage/hash/file type details
- `allFilesPrintable`

## State Changed
None

## Calls
Pure checks only.

## Called By
- `queuePrintJobIfPaymentReady`
- print queue creation paths

## Security Rules
- Payment must be `collected` or `verified`.
- Cancelled/paused/failed orders must not print.
- Every file must have private storage path and SHA-256.
- Only PDF files are printable.

## Failure Cases
- missing file rows
- missing private storage metadata
- non-PDF document
- cancelled or non-printable order status

## Tests
- unpaid order does not queue
- collected order with missing hash does not queue
- collected multi-file order queues only when all files are printable

## When To Edit
When changing payment-ready or file-readiness rules.

## When Not To Edit
Do not edit for UI labels or printer OS command flags.

## Risk Level
Critical
