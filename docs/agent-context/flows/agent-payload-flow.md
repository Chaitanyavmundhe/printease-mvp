# Agent Payload Flow

## Purpose
Build the job payload the desktop agent receives after payment is ready and the backend creates or finds a print job.

## Actors
- Backend
- Supabase Storage
- Desktop agent

## Entry points
- `GET /api/agent/jobs/next`
- `GET /api/desktop/print-jobs`

## Input
- authenticated desktop agent token
- `print_jobs` row
- linked `print_order_files`
- linked private documents

## Output
- JSON payload with one job and a `files[]` array of signed PDF URLs, hashes, copies, and print options

## Source of truth
- `print_jobs`
- `print_orders`
- `print_order_files`
- `documents`
- private Supabase Storage

## State changes
- normally none while building payload
- signed URL is created with short TTL

## Micro-components used
- `toAgentJobPayload`
- `resolveDownloadUrl`
- `parsePrivateStorageReference`
- `optionsForDeliveredPdf`

## Files involved
- `backend/src/controllers/agentController.js`
- `backend/src/services/agentJobPayloadService.js`
- `backend/src/services/printJobReadinessService.js`
- `backend/src/db/repository.js`
- `backend/src/utils/printReadyPdf.js`

## Security rules
- Never send Supabase service role key to desktop.
- Only backend creates signed URLs.
- Keep signed URLs short-lived.
- Include hashes so desktop can verify downloaded files.
- Preserve `files[]`; do not collapse multi-file jobs to only the first file.

## Known risks
- Missing `files[]` makes multi-file printing skip documents.
- Missing hash disables tamper detection.
- Wrong `printOptions` can print with incorrect settings.
- Long-lived signed URLs increase document exposure.

## Tiny tasks
- Add focused tests for `toAgentJobPayload` with multi-file orders.
- Add a contract test that every file has `fileUrl`, `fileSha256`, `copies`, and `printOptions`.

## Tests
- Seed a paid multi-file order and poll with desktop agent token.
- Confirm payload includes all files.
- Confirm desktop downloads and verifies every file before printing.
