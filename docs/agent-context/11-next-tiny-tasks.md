# Next Tiny Tasks

## Completed
- Manual collection logic extracted to `backend/src/services/manualCollectionService.js`.
- Print readiness checks extracted to `backend/src/services/printJobReadinessService.js`.
- Agent payload creation extracted to `backend/src/services/agentJobPayloadService.js`.
- Desktop-side hardening commits exist locally in `printease-desk` and should be pushed when approved.

## Next Tiny Task 1

Task: split method validation into an exported pure helper.

Allowed files:
- `backend/src/services/manualCollectionService.js`
- focused backend tests
- related docs

Do not touch:
- Razorpay
- desktop
- upload
- document download

Test:
- invalid method returns 400
- `cash` works
- `manual_upi` works
- duplicate collection remains idempotent

## Next Tiny Task 2

Task: add contract test for multi-file agent payload.

Allowed files:
- `backend/src/services/agentJobPayloadService.js`
- focused backend tests
- related docs

Do not touch:
- desktop local printer execution
- Razorpay
- auth

Test:
- paid multi-file order returns all files in `files[]`
- each file has signed URL, SHA-256, copies, and print options
