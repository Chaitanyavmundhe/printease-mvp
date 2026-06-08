# Contract: agent-payload-contract

## Purpose
Defines the backend-to-desktop print job payload. The desktop agent consumes this contract when polling for paid/collected jobs.

## Shape
```json
{
  "jobId": "print job id",
  "orderId": "order id",
  "orderCode": "human readable code",
  "hubId": "hub id",
  "agentId": "agent id or null",
  "sourceBackendUrl": "official backend URL",
  "files": [
    {
      "documentId": "document id",
      "fileUrl": "short-lived signed URL",
      "fileSha256": "sha256 hex",
      "fileName": "document.pdf",
      "fileType": "application/pdf",
      "pageCount": 2,
      "selectedPages": "all",
      "selectedPageCount": 2,
      "copies": 1,
      "printOptions": {},
      "printReady": true
    }
  ],
  "fileUrl": "legacy single-file signed URL",
  "fileSha256": "legacy sha256 hex",
  "fileType": "application/pdf",
  "copies": 1,
  "paperSize": "A4",
  "colorMode": "bw",
  "printOptions": {},
  "paymentVerified": true,
  "approvedForPrint": true,
  "printable": true,
  "printerName": "optional printer name",
  "status": "assigned",
  "createdAt": "ISO timestamp"
}
```

## Used by
- `agent-payload-flow.md`
- `desktop-job-polling-flow.md`
- `backend/src/services/agentJobPayloadService.js`
- `printease-desk/desktop-shell/agent/jobPoller.js`

## Security considerations
- `files[]` is required for multi-document jobs.
- Signed URLs must be created only by the backend and must be short-lived.
- Desktop must verify `fileSha256` after download.
- Desktop must not receive Supabase service role keys or raw storage credentials.
