# Production Hardening: 2026-10-27

Release preparation update: the later manual-only payment change supersedes this
audit's Razorpay/demo-loader recommendations. Those handlers and the SDK have
been removed; see MANUAL_ONLY_PAYMENTS_2026_10_27.md. Version 0.1.115 is being
prepared for the user-authorized release; audit results below remain historical,
not a claim that unresolved production deployment/hardware gates are complete.

Status: local hardening pass; NOT a production-safety certification.
Follow-up: see ADVERSARIAL_TESTING_2026_10_27.md for three additional reproduced gaps and their fixes (backend now 142 tests; focused desktop regressions 44).
No commit, push, tag, release, production database operation, or real print was performed during that initial audit.
Existing pending preview/configuration/location/update-source work was preserved.

## Plan and Boundaries

1. Establish actual backend/web/desktop contracts; do not rely on pasted estimates.
2. Audit separate account/document, payment/order, desktop, and frontend state boundaries.
3. Patch reproducible defects with regressions; keep shared frontend changes aligned.
4. Build web and desktop renderer, exercise an isolated Linux package, and check dependency advisories.
5. Hold publication until the database, storage, Windows, printer, and hosting gates below pass.

The initial specialist review used an Astra agent at the user's request. After the user requested lower consumption, that agent was stopped; no further agents were started. Findings were reviewed locally, including corrections to two new desktop guard edge cases.

## Fixed in This Pass

### Backend Access and Abuse Controls

- authController.js: reserve account-based login attempts atomically before bcrypt. Username/email/punctuation aliases share a budget; lockout tracking failure returns 503 instead of bypassing protection.
- authMiddleware.js: explicitly pin legacy JWT verification to HS256 and require exp/id. A supplied invalid optional credential returns 401, not anonymous access. Requests without credentials still support capability-scoped loginless printing.
- rateLimitMiddleware.js: aggregate auth attempts by IP instead of letting rotating identifiers create new budgets. Bound the database-outage fallback map; do not evict active limits.
- uploadMiddleware.js: bound multipart field count/size, parts, and files, retaining 50 MB per-file support.
- uploadController.js: validate capability/centre before storage work and remove stored objects if document persistence fails.
- documentPreviewService.js: replace a nonexistent storage SDK method with info(), and reject missing/oversized metadata and oversized returned blobs.
- document controllers/routes: require a verified converted-PDF hash; private responses are no-store and upstream error detail is not returned.
- app.js/originPolicy.js: exact opt-in Vercel preview allowlist, not tenant-name substrings; rate limit before JSON parsing; API no-store; omit query credentials from HTTP access paths.

### Backend Agent and Print Authority

- agentRepository.js: a device cannot be transferred across hubs by a conflicting registration. Re-pairing revokes old credentials; confirmation checks current generation, expiry, and revocation under lock.
- agentAuth.js: heartbeat cannot clear a hub-administered pause; revoked agents cannot receive a successful heartbeat.
- agentPreparation.js: verify the exact order/document association again under locks; reject mutation of a shared conversion artifact belonging to another hub. Success still requires uploaded PDF bytes verified by the backend.
- agentPrinters.js: validate and cap printer inventories; replace them transactionally under the agent lock.
- printJobRepository.js: callbacks/read access require claimed-job ownership. Advancing jobs recheck trusted payment and current agent/order state; stale terminal callbacks cannot reopen work.
- Download-before-payment remains a separate predownload-only path. It does not create/claim/advance a print job and does not settle money.

### Billing and Data Integrity

- orderUpdateController.js: collection before a customer payment request now returns an HTTP conflict, not a false success. Reject malformed payment methods/string auto-print booleans.
- calculatePrice.js/orderCreationController.js: reject unsupported copy counts, missing/negative/non-finite rates, oversized configuration batches/ranges, and integer bill overflow.
- An explicitly configured zero manual rate remains valid; unknown pricing is not silently treated as free.
- schemaRunner.js: schema/migration SQL and ledger writes use a single transaction client, serialized with a transaction-scoped advisory lock. Previous pooled BEGIN/COMMIT calls could use different connections.
- documentRetentionService.js: bounded 15-day cleanup includes original AND converted storage objects, skips live print work, uses portable text/UUID comparisons, and serializes duplicate cleanup callers. Storage errors retain database rows for retry.
- Cleanup preserves the previous parent order/history snapshot policy; per-file rows are still removed when their documents expire. This is not a new permanent server-history guarantee.

### Linux and Windows Desktop

- ipcSecurity.js/rendererTrust.js: privileged IPC requires the registered main webContents, its top frame, and the actual trusted app entry, not any app:// page.
- documentDownload.js: HTTPS-only, public destination validation on each redirect and DNS result, pinned resolved addresses, bounded bytes/time, and no publication of partial cache files.
- Mapped/private/unspecified IPv6 destinations are rejected too.
- documentCache.js: hashed non-colliding keys, exclusive private file writes, streaming hashes, size caps, and stale partial-file cleanup that preserves active downloads.
- print preparation: contained output filenames, isolated LibreOffice profiles, bounded command output/time, and process-tree termination for timed-out conversions.
- jobPoller.js: only paymentVerified=true authorizes dispatch. Terminal/paused job AND order states are checked independently.
- authStore.js: renderer-facing pairing state omits the agent bearer token. Registration still transfers a freshly issued credential to main for secure storage.

### Both Frontends

- api.js: history/detail caches are isolated by login/capability identity; late private file responses cannot be delivered into another account.
- App.jsx: stale startup-auth and order-restoration responses are ignored; initialization failures clear checkout loading.
- Late checkout completion/dismissal after logout cannot restore a prior user's order or start verification as the new session.
- razorpay.js: bounded script loading, actual constructor validation, and retry after failed loading.
- No changes to settlement requirements, centre prices, collection authority, early-download timing, or desktop registration tools.

## Database Compatibility Migration

New file:
backend/src/db/migrations/20261027_align_runtime_status_constraints.sql

Old constraints excluded values emitted by current code:
agents.online, agent_pairing_sessions.confirmed, and payment requested/not_requested.
The new migration replaces the named checks without rewriting records. The old migration was also corrected for fresh setups.

NOT VALID intentionally avoids rejecting unknown historical rows during rollout; new writes are checked.
Audit historical values before separately validating constraints. No migration was applied to Supabase here.
The disposable PostgreSQL check covers text/UUID fixtures, idempotency, canonical writes, rejection of invalid writes, and preservation of historical rows.
It does NOT prove every historical migration succeeds against the live production schema.

## Validation

- Backend: 123 tests passed.
- Web frontend: 121 tests passed.
- Desktop frontend: 89 tests passed.
- Focused desktop Node suites: 38 passed, including payment/cancel/cache/converter/update protections.
- Node syntax: 136 backend and 76 desktop files passed.
- Both frontend production builds passed; desktop frontend-dist rebuilt.
- Linux unpacked package built and package verification passed.
- Actual installed Linux LibreOffice 24.2.7.2 completed the isolated generated-text-to-PDF smoke conversion successfully; no customer files or printer jobs were used.
- Browser checks: web at 1300/360/320 widths and desktop 1300/1000 widths; document preview, scroll, canonical save, and reopen retention passed.
- Isolated Electron Linux smoke: local PDF, verified converted PDF, hub activity/history preview rendered with no page errors, external CDN worker dependency, or unexpected writes. APIs/storage/payment responses were fixtures.
- Dependency audits: backend production graph, both frontend graphs, and desktop-shell graph reported zero advisories at check time. This is not a proof of application security.
- Windows package check against the pre-existing local win-unpacked directory FAILED: it is missing the new converter files. No fresh Windows package was built on Linux. A new native Windows CI build/scan is a release gate.

Build warnings: large existing vendor chunks remain; no risky chunking/lazy-loading rewrite was attempted.

## Unresolved Release Gates

1. Database TLS: config/db.js still disables certificate verification when its SSL flag is used. Configure a trusted Supabase CA and verified TLS in a separately tested deployment. Do not claim production readiness with this unresolved.
2. Supabase API grants/RLS/private bucket settings have NOT been inspected live. Run the read-only access audit. Private GitHub source does not protect exposed database grants or leaked secrets.
3. Back up production, stage the actual current schema, apply all pending migrations with the deployment database role, then exercise username login, pairing, requested-payment, conversion, and printing states.
4. Native Windows install/update, LibreOffice first-run conversion, Sumatra configuration, cancellation, and spool reconciliation remain untested on real hardware. Linux CUPS real printing is also untested in this pass.
5. Headless Office conversion processes untrusted files with the desktop OS user's privileges. Antivirus, patched LibreOffice, least-privileged shop account, and sandbox/isolation hardening remain required. A timeout is not a document sandbox.
6. Already issued signed storage URLs remain usable for their short lifetime. Revoking an agent/user does not revoke those URLs instantly.
7. Browser JWTs remain in localStorage and have no server-side per-session logout/revocation. CSP, token rotation, shorter-lived sessions or cookie design require a dedicated compatible auth change.
8. Rate limiting is not full DDoS protection: configure trusted ingress/proxy handling, edge limits, upload/conversion concurrency budgets, body/time limits, pool sizing, monitoring, and load tests. The in-memory fallback is only per process.
9. Converted-object cleanup after a later conversion-report transaction conflict is still best-effort; reconcile orphan objects and monitor failed reports.
10. Persistent local caching is not promised encrypted-at-rest on every OS. Restrict shop account/filesystem access, enable disk encryption, and verify token secureStorage availability.
11. Storefront cleanup runs in batches of 100. Monitor backlog and storage removal failures; storage and PostgreSQL cannot commit atomically.
12. Check paid/cancel/refund reconciliation with real provider sandbox events and manual collection retries. No real charges/refunds were attempted.

## Deployment Settings and Safe Rollout

- Keep DEMO_PAYMENT_ENABLED=false. Current active handler also blocks production even if the flag is accidentally true.
- Keep RAZORPAY_ENABLED=false while using counter/manual payment. Retain future Razorpay support; do not enable it by merely hiding/showing a frontend button.
- Never publish service-role/JWT/payment secrets in VITE_* or desktop assets.
- Keep ALLOW_VERCEL_PREVIEW_ORIGINS=false in production unless needed. If enabled, VERCEL_PREVIEW_ORIGINS must list exact comma-separated HTTPS preview origins.
- Keep private source separate from public binary distribution. No GitHub auth token belongs in the installer.
- v0.1.115 public-update-source work remains LOCAL, not published. Existing private-feed apps need a one-time manual install when a stable public build is published.
- Do not force-push, reset work, blindly stage environment files, or publish untested binaries.
- Release only after the gates pass; verify public latest.yml/latest-linux.yml, expected artifact hashes, and Windows/Linux installation separately.

## Sources for Decisions

- node-postgres single-client transaction requirement: https://node-postgres.com/apis/pool
- Exact CORS origin handling: https://expressjs.com/en/resources/middleware/cors/
- Verified PostgreSQL TLS and Supabase certificate setup: https://supabase.com/docs/guides/database/connecting-to-postgres
- node-postgres SSL URL option override warning: https://node-postgres.com/features/ssl

These notes supersede readiness percentages and unconditional fraud-proof claims in pasted third-party assessments.
