# Component: validate-manual-collection-method

## Size
Tiny

## Domain
Backend

## Flow
Manual Collection

## Current File
`backend/src/services/manualCollectionService.js`

## Future File
Keep here as an exported pure helper if it is split out.

## Purpose
Allow only known offline collection methods and prevent invalid input becoming cash by default.

## Input
- raw method string from request body

## Output
- `CASH`
- `MANUAL_UPI`
- or an invalid-method error

## State Changed
None

## Calls
No external calls when kept pure.

## Called By
- `processManualCollection`
- `collectCashPayment`

## Security Rules
- Reject anything except `cash` and `manual_upi`.
- Never default unknown values to `CASH`.

## Failure Cases
- invalid/missing method -> HTTP 400 from controller

## Tests
- invalid method returns 400
- `cash` creates `CASH`
- `manual_upi` creates `MANUAL_UPI`

## When To Edit
Only when adding a new offline collection method.

## When Not To Edit
Do not edit for Razorpay, upload, or print queue behavior.

## Risk Level
High
