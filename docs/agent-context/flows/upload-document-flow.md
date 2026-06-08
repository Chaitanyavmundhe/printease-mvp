# Upload Document Flow

## Purpose
Accept a PDF, validate it, count pages, store it in private Supabase Storage, and create a document metadata row.

## Actors
- User or loginless visitor
- Backend
- Supabase Storage

## Entry points
- `POST /api/uploads`
- frontend upload page

## Input
- multipart `document` file
- optional authenticated user token

## Output
- document record with ID, file name, storage path, SHA-256, file size, and page count

## Source of truth
- private Supabase Storage
- `documents`

## State changes
- storage object is written
- document row is inserted

## Micro-components used
- PDF MIME/header validation
- PDF page counter
- SHA-256 hash creation
- safe file name generation

## Files involved
- `backend/src/controllers/uploadController.js`
- `backend/src/middleware/uploadMiddleware.js`
- `backend/src/utils/pdfPageCount.js`
- `backend/src/db/repository.js`

## Security rules
- only PDFs
- enforce file size limits
- keep bucket private
- never expose service role key to frontend/desktop
- loginless upload must remain temporary/cleanable

## Known risks
- malicious or expensive PDF parsing
- orphaned guest uploads
- public bucket misconfiguration

## Tiny tasks
- test PDF timeout behavior
- test orphan cleanup

## Tests
- valid PDF uploads
- non-PDF rejected
- corrupted PDF rejected
- document row has page count and hash
