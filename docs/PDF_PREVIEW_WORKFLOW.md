# PDF Preview Workflow

Updated October 27, 2026. Included in desktop release 0.1.113 and its companion
web frontend update. Release publication requires both OS builds and their
package checks to pass; preparing a tag alone does not prove publication.

## Scope And Invariants

This change is a read-only viewer fix. Backend code, database schema, pricing,
payment/collection, print execution, early download and conversion delivery are
unchanged. No preview action starts conversion or creates an order. Original-file
download buttons keep their existing behavior. The colour-printing investigation
is separate and is not fixed by this preview work.

## File Selection

- Original PDFs preview directly; locally selected files need no preview upload.
- Office/OpenDocument files request the existing authorized signed-download
  endpoint with converted=true. The backend returns only a verified converted
  PDF or HTTP 425 while that artifact is pending; the original is never substituted.
- Non-PDF metadata explicitly identifying desktop preparation or a verified PDF
  also selects the converted preview. Ordinary image/text previews remain direct.
- services/documentPreview.js is shared by user history, hub activity and hub
  history. utils/documentPreview.js owns file selection, naming and pending policy.
  Upload's existing converted-preview request uses the same backend endpoint.

## Worker And Desktop Security

InlineDocumentFrame.jsx imports its worker through new URL(..., import.meta.url)
so Vite emits the matching installed PDF.js worker into assets. The old external,
protocol-relative unpkg URL resolved to app://unpkg.com in the desktop shell.
The worker is now copied into frontend-dist and packaged with the renderer.

Desktop CSP permits same-origin/blob workers and blob PDF reads. It does not
permit arbitrary HTTPS worker origins, disable CSP, enable Node integration, or
disable the main renderer sandbox. PDF.js uses a blob wrapper for custom app://
origins; its imported module is still a bundled local asset.

## Cached Bytes And Authorization

getDocumentPreviewBlob first uses the existing identity-scoped in-memory cache.
On a miss, it requests authorized artifact metadata before trying a desktop disk
copy. A disk copy is accepted only when its SHA-256 matches the selected artifact's
backend hash. An original Office source or differently transformed order render
cannot masquerade as the verified conversion. Cache misses fall back to the
authorized signed link. The viewer never changes the agent's cache or its keys.

A fresh disk-cache lookup still needs authorization metadata. This change does
not grant new offline permissions or redesign account scoping of the agent cache.
Already loaded in-memory blobs can be reopened for the same session.

## Loading, Errors And Cleanup

- Only HTTP 425 permits automatic converted-preview retries: one request at a
  time, three-second spacing, for up to two minutes of pending responses.
- Authentication, missing-file and network errors are displayed, not labelled as
  conversion. A retry button allows another read without restarting conversion.
- Closing/switching a preview invalidates old responses and clears retry timers.
  Owned object URLs are revoked on close, replacement or unmount.
- A locally parsing PDF updates an already-open loading preview when parsing
  reaches ready/failed, without changing upload/order preparation.
- A caller-provided local blob is not redundantly fetched from the server.

## Verification

Regression tests were added before implementation and reproduced the external
worker URL, original-Office selection, stale response and endless loading problems.
Each frontend passes 30 tests. The unchanged backend passes 74 tests and the
desktop print-safety suite passes 8 isolated tests. Both production frontend
builds pass, and desktop frontend-dist is rebuilt with its local worker asset.

desktop-shell/tests/pdfPreview.smoke.cjs runs actual PDF canvas/background-worker
checks on desktop Chrome, mobile widths 375/320, and the Linux unpacked app. It
uses a real three-page PDF, mocked Office-conversion responses, isolated login
and desktop profiles, and mocked API/storage requests. It rejects external CDN
requests and unexpected upload/order/payment writes. Temporary servers, browser
processes and desktop profiles are cleaned up; no persistent preview is started.

The Linux test host requires --no-sandbox only for the automation process; no such
flag was added to product startup. This is not a Windows hardware test or a real
Office conversion/payment/print test. Mobile tests use current Chrome viewports,
not physical older Android browsers. Password-protected/corrupt PDFs, unusual
fonts and very large documents require additional compatibility checks. The
existing Vite vendor chunk size warning remains.

## Commands

In either frontend repository:

```bash
npm test --prefix frontend
```

In the desktop repository:

```bash
npm run build:frontend
node --test desktop-shell/tests/printSafety.test.js
npm run verify:package --prefix desktop-shell
```

Run pdfPreview.smoke.cjs with Playwright available on NODE_PATH; it accepts a web
dist directory and optional unpacked Electron executable as its two arguments.
Screenshots/results go to the printed temporary evidence directory, never Git.
Use a fresh local unpacked build to test the current shell CSP and renderer.
