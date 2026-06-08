# Contract: document-contract

## Purpose
Defines uploaded document metadata. The file bytes live in private Supabase Storage.

## Shape
```json
{
  "id": "document id",
  "userId": "user id or null",
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "fileSizeBytes": 12345,
  "fileUrl": "private://bucket/path",
  "storagePath": "private storage path",
  "fileSha256": "sha256 hex",
  "pageCount": 2,
  "createdAt": "ISO timestamp"
}
```

## Used by
- upload document flow
- draft order flow
- document download flow
- agent payload flow

## Security considerations
- Storage bucket must be private.
- Signed URLs must be short-lived.
- `fileSha256` must be preserved for desktop verification.
