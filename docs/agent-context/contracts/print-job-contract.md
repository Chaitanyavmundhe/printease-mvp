# Contract: print-job-contract

## Purpose
Defines the queued print job row and status values used between backend and desktop agent.

## Shape
```json
{
  "id": "print job id",
  "orderId": "order id",
  "hubId": "hub id",
  "agentId": "agent id or null",
  "printerName": "selected printer or null",
  "status": "queued",
  "fileUrl": "legacy signed/private reference",
  "fileSha256": "sha256 hex",
  "fileType": "application/pdf",
  "copies": 1,
  "paperSize": "A4",
  "colorMode": "bw",
  "printOptions": {},
  "createdAt": "ISO timestamp"
}
```

## Used by
- print queue flow
- agent payload flow
- desktop job polling flow

## Security considerations
- Only paid/collected orders can create printable jobs.
- Desktop may claim queued/assigned jobs only for its hub.
- Cancelled jobs must stop local printing as soon as possible.
