# High-Priority Hardening - 2026-10-26

Status: implementation and local checks completed. The user authorized committing
and pushing both repositories on October 26. Consult Git history for publication
state. The user subsequently authorized a Windows/Linux desktop release;
desktop-v0.1.112 is the planned tag. No existing release is overwritten.
Scope: the highest-priority document, payment, print-state, preview and dependency
findings from the October 26 audit. This is not a claim that every audit finding
or every possible vulnerability has been fixed.

## Preserved workflow

1. Upload and Continue to Payment can still trigger early download and Office
   conversion at the selected hub before money is collected.
2. Early download is cache warm-up only. It creates no paid print authorization.
3. Conversion uploads a PDF which the backend independently parses, counts,
   hashes, and uses for the pending bill.
4. The customer creates a manual request, or starts an authenticated online
   payment, only after every printable artifact and line price is verified.
5. A manual request does not collect cash. The hub explicitly records cash/UPI.
   Auto-print off still requires the hub's Send action after collection.
6. Online authorization alone does not count as captured payment. Only verified
   capture can activate a print job.
7. A paid order is dispatched idempotently under a row lock; its snapshots are
   no longer repriced by later conversion reports. A new reprint has a new bill.

## Fixes, in order

### Document access and printable-byte integrity (S01-S03)

- Public hub assignment checks the authenticated uploader or the unexpired
  anonymous upload capability in the UPDATE itself. A document already tied to
  another hub's order cannot be reassigned by that endpoint.
- The document mapper now retains the internal guest-token hash and expiry;
  missing, wrong, expired and registered-document guest capabilities are rejected.
- Both frontends reuse the first anonymous upload's capability for subsequent
  files and checkout. This preserves limited loginless multi-file uploads.
- An original PDF cannot carry a different secondary printable PDF. A non-PDF
  secondary PDF must parse successfully; storage failure rejects the upload
  rather than pairing one file's count with another file's printable bytes.
- Prepared documents are immutable. Repeat agent reports can refresh eligible
  pending bills but cannot replace verified bytes, override counts, or revert
  prepared status. Verification reports must refer to a file in the target order.

Primary modules: uploadController.js, documentRepository.js,
guestAccessService.js, documentPreparationPolicy.js, agentPreparation.js.

### Cleanup authorization (S04)

The public/default cleanup credential was removed. The cleanup endpoint returns
503 without SYSTEM_CRON_SECRET and uses a timing-safe comparison when configured.
Set a long random SYSTEM_CRON_SECRET on the backend and configure the caller to
use the same secret before deploying. Do not place it in frontend/VITE variables,
documentation, Git, or release assets. This change does not redesign retention.

### Payment readiness and settlement (S06-S08)

- paymentReadinessService.js enforces prepared PDFs, positive verified page
  counts, nonnegative integer line prices, consistent totals, and the existing
  anonymous printed-page limit at payment and print activation boundaries.
- Genuine zero-price manual bills remain possible; unknown/pending prices do
  not become zero-price bills. Online payment requires a positive amount.
- Manual request/collection and online initialization recheck the locked order.
  Repeated manual requests do not create extra payment rows.
- Online attempts store the bill amount and configuration version. A changed
  bill cannot be silently settled using an older attempt.
- razorpaySettlementService.js checks provider reference, amount and currency.
  Checkout confirmation fetches the provider payment server-side after validating
  its signature; webhooks require the existing HMAC signature.
- Captured payments settle monotonically. Authorized events do not print; late
  failed events do not undo another successful payment or cash collection.
- Captured money for cancelled/changed/already-paid orders is retained for
  reconciliation without activating printing. Another collection/payment attempt
  is blocked when an unsettled order already has a settled payment record.
- QR payments use the authenticated qr_code.credited reference, not customer
  notes. Subscribe to that event in Razorpay in addition to payment events if
  provider-generated UPI QR is enabled. Manual shop QR/cash remains separate.
- Demo verification is forbidden in production even if its development flag is
  accidentally enabled.

Razorpay reference:
https://github.com/razorpay/markdown-docs/blob/master/webhooks/qr-codes.md

### Dispatch, cancellation and immutable history (B01-B03, B07)

- Manual Send uses the same order-locked queue service as payment activation.
  Active work, including submitted jobs, is reused instead of duplicated.
- Agent updates validate the prior job state and terminal order state while
  holding order/job locks. Cancelled/completed work cannot be resurrected by a
  delayed printing/completed callback. Legacy desktop status labels are mapped
  to canonical values.
- Hub completion is rejected while a print job remains active; failed/cancelled
  hub actions stop active jobs. Completed orders cannot be reopened in place.
- The desktop now checks accepted/downloading/printing acknowledgments and
  fails closed if the backend cannot confirm print authority.
- The scoped GET /api/agent/jobs/:jobId endpoint requires the existing agent
  middleware and returns only that agent/hub's job state, with no-store caching.
- Only the paid print loop monitors cancellation. Predownload/conversion
  endpoints, selectors, cache population and conversion policy remain separate.
- Linux tracks its exact CUPS request ID. Windows uses a unique PrintEase PDF
  filename and filters Get-PrintJob/Remove-PrintJob to that file/printer. No
  whole-queue purge or taskkill by SumatraPDF image name remains.
- Spool polling is bounded to one hour and cancels owned pending work on timeout
  or lost authorization. Failed PDF settings preparation no longer prints the
  original with silently ignored settings.
- Stop pauses new print claims but keeps early download/conversion alive;
  Restart Auto Print resumes claims. Update installation is blocked during active
  conversion/printing so it cannot interrupt these tasks.
- Settled/config-locked/terminal order bills and snapshots are frozen during
  preparation reports. Pending configuration uses the verified document count.
  The UI no longer offers editing an already collected bill.
- Final print-artifact review also fixed page-range/watermark transformation for
  already-converted Office PDFs: their bytes use the PDF branch, "all" is a
  supported selection, and the verified prepared count takes precedence over a
  legacy zero original count. Source hashes are checked before transformation;
  rendered output URLs include their content hash so concurrent requests cannot
  replace bytes behind an earlier signed URL. PDF metadata and date/time
  watermarks use the order-file submission timestamp so repeated early
  downloads reuse the same hash instead of creating a new file on each poll.
  The date/time stamp describes that order submission, not verified physical
  paper delivery time. Derived render retention/quota
  cleanup still needs the separate storage-retention review noted below.

Physical limitation: removal from a spool queue is not proof of paper delivery.
Pages already printed cannot be recalled; printers/drivers can buffer pages.
If a driver hides/renames the unique Windows document title or the app loses its
connection to the spooler, inspect that printer's queue before retrying. No
automatic retry of a partially printed order was added. Windows hardware tests
remain required; isolated tests do not prove physical cancellation.

### Preview/configuration correctness (B05-B06)

- Authorized document queries return the converted PDF path/hash/count/status.
  Explicit converted requests return 425 while pending, never the Office source.
- Both frontends reject non-PDF bytes from a converted-PDF response and clear
  private blob caches when the active login/capability changes.
- Every local preview branch carries its file index. Editing a second PDF's
  copies updates that file, not an undefined configuration key.

### Dependency batch (S05)

Compatible dependency updates and generated lockfiles address the audit results.
Vite and React Router were moved to patched releases in both frontends. The
unused public PPTX metadata parsing call was removed, and adm-zip was updated.
The desktop uses Electron 44.9.3, electron-builder 26.18.0 and a patched updater
via its lockfile. Electron 44 is a supported, established branch as of this date:
https://releases.electronjs.org/schedule

The installed system npm 10 updater hit an Arborist edgesOut error while
resolving optional peers. npm 11.6.2 generated the updates; ordinary npm 10
`npm ci --ignore-scripts` was subsequently checked for the backend/frontends.
No global npm installation, legacy-peer-deps override, or forced audit upgrade
was used. A clean audit means no reported advisory in that snapshot, not proof
that the application is secure.

## Checks and release gates

Completed local checks:

- Backend: 15 test files, 74 tests passed, including real PDF-byte page slicing,
  Office-PDF watermarking and source/output integrity checks.
- Each frontend: 4 test files, 7 tests passed, including private blob/capability
  handling and editing the second file's ready-preview configuration.
- Desktop: 8 isolated print/cancellation tests passed without printer commands.
- Both production frontend builds passed; desktop frontend-dist was rebuilt and
  matches the web build. Vite still reports a large vendor chunk warning.
- Both Linux/Windows package configuration verifiers passed. Relative entry
  assets and Register This Desktop / Auto-print / Restart Auto Print remain in
  the generated bundle.
- Node syntax checks passed for 162 backend/desktop source files.
- The Linux unpacked app opened its home/upload screens on Electron 44.9.3 with
  zero page errors in the isolated smoke test. No authenticated dashboard,
  converter, payment API or physical printer was exercised in that smoke test.
- Dependency audits reported zero known advisories in the backend, both
  frontends and desktop-shell, and both repository roots after fixing the root
  nodemon tree's vulnerable brace-expansion lock entry.
- Shared frontend source/manifests/locks match; git diff --check passes. Both
  starting Git HEADs were unchanged and nothing was staged at the end of the
  initial local verification, before the user's later push approval.

Re-run before review:

```bash
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
```

In the desktop repository:

```bash
npm test --prefix frontend
node --test desktop-shell/tests/printSafety.test.js
npm run build:frontend
npm run verify:package --prefix desktop-shell
PE_TARGET_PLATFORM=win32 npm run verify:package --prefix desktop-shell
```

The Linux unpacked build and Playwright smoke check use an isolated user-data
directory and mocked HTTP requests, not the saved desktop agent session. The
Xvfb harness uses --no-sandbox for the test host only; no such switch was added
to product startup. Its sandbox preference is checked separately. No Windows
installer was built on Linux, and no real payment, printer or production DB was
used for this task.

Required before a later approved deployment/release:

1. Review the diff and set backend SYSTEM_CRON_SECRET for the cleanup caller.
2. Test with an isolated PostgreSQL database: concurrent Send/collect/cancel,
   conversion retries, UUID/text schema compatibility and transaction rollback.
   No migration is added or required by these code changes.
3. Deploy backend changes before using the new desktop. The scoped status read
   includes a compatibility fallback, but the state/payment guards require the
   patched backend to provide the complete protection.
4. Exercise manual cash/UPI with Auto-print both on/off, and Razorpay test-mode
   captured/authorized/failed/duplicate/QR events. No live payment test was run.
5. Test real Linux CUPS and Windows SumatraPDF/Get-PrintJob: two PDFs with
   different copies/ranges, cancelled mid-job, offline/wake-up, retained queued
   data, and Restart Auto Print. Check printer driver titles and buffering.
6. Test Office conversion -> verified price -> request -> explicit collection ->
   paid print, plus already-prepared document retries and reprints. Converter
   placement and LibreOffice installation policy were not changed.
7. Only after approval, consider a new version/tag and Windows release build.

## Remaining work, deliberately not hidden

The audit's medium/low items are not all resolved here: converter job leases and
fair retries; recursive cache quota/retention; live Supabase RLS/bucket review;
database TLS configuration; resource-isolated parsing/concurrency quotas; full
account-scoping of the Electron disk cache; credential storage fallback policy;
frontend/backend duplex/copies rounding agreement; migration runner transaction
handling; release identity/version constants; startup fallback/window-reference
wiring; and small-screen UI issues. These need separate focused changes and
environment/hardware verification. No bundled LibreOffice or new backend code
was added to the desktop package.

## In-code explanation map

The October 26 fixes now include comments beside the affected guards. Comments
describe purpose and failure mode, not a claim of complete security. They do not
change runtime behavior. Use these symbols to find the relevant changed lines:

- `uploadDocument` / `assignHub`: bind printable bytes to counted bytes, fail a
  partially stored upload, and require ownership before changing its hub.
- `assertGuestCanUseDocument` / `mapDocument`: retain internal capability/expiry
  fields and reject missing, expired or registered-document anonymous access.
- `assignOwnedDocumentHub` / `findDocumentAccessContext`: authorize inside SQL;
  apply the access predicate before choosing one matching order.
- `assertPreparationReportCanReplace` / `updateDocumentPreparation` /
  `reportPreparationResult` / `reportVerificationResult`: preserve verified
  documents, repeat immutability checks under a row lock, and check order membership.
- `createSignedDownload` / `previewDocument` / `downloadDocument`: return explicit
  pending-conversion errors instead of disguising an Office file as a PDF.
- `cleanupOldData`: remove the public cleanup fallback and use fixed-length,
  timing-safe credential comparison. Configure SYSTEM_CRON_SECRET before deploy.
- `requestManualPayment` / `processManualCollection` / `assertTrustedOrderBill`:
  separate intent from collection; verify pages, line amounts and the bill before
  settlement. Missing pricing is not a free bill.
- `createRazorpayOrder` / `createRazorpayUpiQr` / `verifyRazorpayPayment` /
  `applyProviderPayment` / `assertPaymentMatchesBill`: recheck bill versions,
  verify captured funds server-side and preserve reconciliation without printing.
- `findSettledPaymentForOrder`: prevent a second charge after received funds have
  been recorded but the order still needs reconciliation.
- `findOrderByIdOrCode` / `queuePrintJobIfPaymentReady` / `sendOrderToAgent`:
  serialize paid dispatch and retain every order file in the same transaction.
- `assertPrintJobTransition` / `updatePrintJobStatus` / `updateOrderStatus`:
  prevent delayed callbacks or hub edits from reviving terminal work.
- `calculateAndPersistTrustedOrderBill` / `applyOrderConfigurationChange`:
  freeze paid history and use verified PDF counts for pending configuration.
- `getPrintReadyFile` / `renderTimestamp`: verify source bytes, process converted
  PDFs as PDFs, and keep content-addressed output/cache hashes stable across retries.
- Frontend `App`, `canConfigureOrder`, `UploadPage`, `createHeaders` and
  `fetchSignedDocumentBlob`: preserve multi-file access, payment state and the
  preview file index; prevent collected-bill edits and cross-session blob reuse.

JSON manifests and generated lockfiles intentionally contain no comments because
JSON does not support them. Their changes update adm-zip, Vite, React Router,
Electron and transitive dependencies identified by the audit. Do not manually
edit lockfile integrity fields. Regression tests document expected behavior in
their named cases; no test or comment proves live payment or printer behavior.

The companion desktop notes map the platform-specific cancellation, timeout,
restart and updater comments. Shared frontend comments are identical in both repos.

### Subsequent release approval

After the documentation pass, the user authorized pushing both repositories and
publishing Windows/Linux desktop builds. Desktop package metadata is bumped to
0.1.112. The desktop startup log now reads its version from package metadata,
and CI checks every required update asset plus the packaged Windows print helper.
The payment/DB/hardware checks listed above remain limitations, not claims of
verification made by the release automation. Set SYSTEM_CRON_SECRET for the
backend cleanup caller; no new SQL migration is required by this batch.
