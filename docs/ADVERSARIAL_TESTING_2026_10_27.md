# Local Adversarial Testing: 2026-10-27

Status: reproduced failures fixed locally; no deployment, push, release, live charge or print.
This is a targeted regression pass, not a claim that every vulnerability is eliminated.

## Scope and Safety

- Real HTTP requests to an ephemeral 127.0.0.1 server, using actual Express routers, JWT/role middleware, HMAC verification and payment policies.
- Repository, payment-provider and storage responses were fixtures for the HTTP tests. No real merchant/storage APIs were contacted.
- Actual document authorization SQL ran against disposable PostgreSQL 16 instances with text and UUID ID layouts. Production credentials and customer records were not used.
- Desktop adversarial cases used injected DNS/transport fixtures, not requests to private or external targets.
- No additional agents or high-consumption models were used in this pass.

## Reproduced Failures and Fixes

### Expired loginless order capability

Before: a matching guest token with an expired, missing, or invalid expiry returned HTTP 200 for order details and HTTP 201 for a new manual payment request.
This was authorization-after-expiry, not access without any token.

Fix: orderUtils.canAccessOrder now requires a finite future expiresAt before accepting a guest capability.
Authenticated owner-hub/admin support access remains separate. Ordinary registered ownership is unchanged.
Legacy loginless records without an expiry fail closed rather than receiving indefinite public-link access.

After: both endpoints return 404 for those capability replays; no payment record is created.
A non-expired valid capability still creates only a pending manual request, never cash collection or a print job.

### Demo settlement with an ambiguous hosting environment

Before: DEMO_PAYMENT_ENABLED=true plus NODE_ENV=staging or an unset NODE_ENV allowed the demo endpoint to settle fixture payments.
NODE_ENV=production was already blocked; this was a deployment-configuration bypass of the intended development-only restriction.

Fix: one shared config/demoPayment.js policy requires explicit development/test mode, the demo flag, AND an actual loopback socket peer.
Forwarded headers cannot impersonate that peer. All retained demo-handler copies use the same policy.

After: staging, empty, unknown and production modes are rejected. Keep DEMO_PAYMENT_ENABLED=false in deployed environments regardless.

### Concurrent upload resource accumulation

Before: three tiny controlled uploads all entered storage processing together even when the intended capacity was one.
The test demonstrated the missing aggregate admission bound; no memory-exhaustion flood was run.

Fix: uploadCapacity.js acquires a permit before multipart parsing and holds it through controller completion.
Default budgets are one customer upload and one independent conversion-result delivery per process.
MAX_CONCURRENT_UPLOADS and MAX_CONCURRENT_AGENT_UPLOADS may configure 1-4 slots, subject to measured host memory.
Overflow returns 503 UPLOAD_CAPACITY_BUSY with Retry-After: 3.
Disconnected clients cannot reopen capacity while their expensive controller work is still running.
Malformed/aborted parsing and completed/failed handlers release the permit.

asyncHandler now returns its actual completion promise so this accounting covers work, not just response events.
Separate agent/customer budgets prevent customer upload occupancy from consuming the PDF-result delivery slot.
Early download, conversion eligibility, captured-payment rules and manual collection authority are unchanged.

After: one controlled upload enters processing; two overlapping requests receive 503.
No filename/type/price/history/UI redesign was made in this pass.

## Attempts That Were Already Blocked

- Cross-account order reads, including a signed JWT with a forged admin role claim: middleware reloads the actual database role.
- A customer calling cash collection or requesting payment for another account.
- Invalid checkout signatures, without provider lookup or order mutation.
- A valid fixture checkout signature for an authorized-only, not captured, payment.
- Normal login credentials presented to agent job endpoints.
- Actual SQL document access from anonymous/foreign users or foreign hubs.
- Wrong/expired document capability tokens, while authorized owner/hub access still works.
- Numeric/encoded loopback download URLs and public-to-private redirects.
- Mixed private/public DNS answers; the socket receives the validated address rather than doing another DNS resolution.
- Oversized declared download bodies and stalled streams; no partial files remain published.
- Existing paid-print, cancellation and cache-boundary regressions remain covered.

## Checks

- Backend full suite: 142 tests passed.
- Desktop adversarial + hardening + print-safety suites: 21 tests passed.
- Full focused desktop regression selection, including converter/download/update/location suites: 44 tests passed.
- Actual PostgreSQL document-access matrix passed for both text and UUID fixtures.
- Both repositories passed git diff --check.
- No frontend source changed during this pass, so the existing web/desktop platform differences were preserved.

Repeat:
- backend: npm test -- --maxWorkers=2
- backend: node scripts/check-document-access.cjs
- desktop repo: node --test desktop-shell/tests/adversarialDownloads.test.js desktop-shell/tests/hardening.test.js desktop-shell/tests/printSafety.test.js

## Limitations and Remaining Gates

The HTTP fixture is not a production penetration test. It does not prove production Supabase grants/RLS, TLS certificate validation, edge/proxy configuration, cloud resource limits or real Windows printer behavior.
The process-local upload budget is not a distributed rate limiter, a parser sandbox, or a full DDoS defense.
Busy uploads currently return a retryable error; no new automatic frontend retry mechanism was introduced.
Already-issued signed storage URLs retain their short TTL; these fixes do not revoke issued URLs instantly.
The earlier production-hardening document remains the release-gate checklist.
No new Supabase migration is required for the fixes in this pass. The previously prepared status-constraint migration remains pending production review.
