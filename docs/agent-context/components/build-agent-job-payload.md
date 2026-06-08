# Component: build-agent-job-payload

## Size
Small

## Domain
Backend / Storage

## Flow
Agent Payload

## Current File
`backend/src/services/agentJobPayloadService.js`

## Future File
Already extracted.

## Purpose
Build a desktop-safe print job payload with short-lived signed URLs for every file in the order.

## Input
- `print_jobs` row
- linked `print_order_files`
- linked private document metadata

## Output
- agent job payload with `files[]`
- legacy single-file fields for compatibility
- signed URLs
- hashes and print options

## State Changed
None, except creating temporary signed URLs in Supabase Storage.

## Calls
- `findOrderByIdOrCode`
- `listOrderFiles`
- `getPrintReadyFile`
- Supabase `createSignedUrl`

## Called By
- `backend/src/controllers/agentController.js`

## Security Rules
- Never expose Supabase service role key.
- Signed URLs must be short-lived.
- Preserve SHA-256 hashes for desktop verification.
- Preserve `files[]`; do not drop extra documents.

## Failure Cases
- signed URL creation fails
- missing storage reference
- no printable files

## Tests
- multi-file paid order returns all files
- each file has signed URL and hash
- service rejects/omits files without storage URLs

## When To Edit
When changing desktop agent payload shape or signed file delivery.

## When Not To Edit
Do not edit for local printing command options unless the payload contract changes.

## Risk Level
Critical
