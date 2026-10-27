# Manual-Only Payments (2026-10-27)

## Current behaviour

Payment checkout now offers only a manual request. Customers can pay cash at the
counter or transfer using the centre's own UPI ID/QR. This is not a payment
gateway: PrintEase never verifies that transfer automatically.

1. Upload/configure documents and continue to payment.
2. Existing conversion, verified page counts, final pricing and early-download
   preparation run unchanged. Preparing a document never authorizes printing.
3. Submit the manual payment request. The backend checks account/capability
   ownership, document readiness, totals and the loginless page limit under the
   existing order transaction lock.
4. The order becomes payment_requested, not collected or verified.
5. Only the authenticated owning hub can confirm Cash/Manual UPI Collected.
6. The existing auto-print checkbox determines whether collection queues a print.
   With it off the hub must explicitly send the order. Existing paid-job guards
   remain in force.

## Code changes and purpose

- Both frontends: App.jsx contains only the manual-request handler. It ignores
  late replies after logout/order changes. Opening an unpaid history entry no
  longer invents a local payment request; it opens the real payment page.
- PaymentPage.jsx: removed gateway choices, checkout actions and online-QR setup.
  Verified prices, conversion refresh, errors, cancellation and login guards stay.
- TrackPage.jsx: removed online retry, generated gateway QR and demo settlement.
  The centre's own QR stays. Unpaid orders cannot display payment-completed text.
- AppRouter.jsx and services/api.js: removed gateway callbacks/API helpers.
- Deleted the external checkout-script loader and its obsolete tests.
- Backend paymentController.js/manualPaymentController.js: manual request and
  manual-only public configuration only; deleted copied/dead gateway/demo code.
- paymentRoutes.js: old /razorpay/* and /verify-demo paths return HTTP 410 with
  ONLINE_PAYMENTS_REMOVED before any settlement logic. Stale environment flags,
  old clients and webhook requests cannot re-enable these actions.
- Removed the gateway SDK dependency, configuration module, settlement service,
  demo helper and obsolete cleanup script. Removed gateway env example keys,
  webhook raw-body parsing and the checkout frame CSP exception.
- paymentRepository.js defaults new method-less records to a manual request.
  Existing transactions/provider fields, labels and migration history stay intact.

## Operations

No new database migration is needed for this change. Do not delete payment rows,
provider columns or old migrations. Existing verified/collected payments remain
valid historical records and are not relabelled as cash.

Deploy the backend and both frontend bundles together. Old clients receive 410
for online payment. Stop accepting gateway charges before deployment; reconcile
any charge already in flight directly with the provider. Webhooks no longer
settle those payments in PrintEase. Do not ask a customer to pay twice.

Remove obsolete RAZORPAY_* and DEMO_PAYMENT_ENABLED variables from hosting settings
and VITE_RAZORPAY_KEY_ID/VITE_DEMO_PAYMENT_ENABLED from frontend build settings.
They no longer activate any code. Real credentials were not read or changed by
this task. Disable the old webhook/checkout configuration in the provider account
and rotate/revoke unused credentials separately.

## Regression checks

Backend loopback HTTP tests use real routing/auth/policies with fixture storage
and database operations, never production payments or printers. They cover removed
endpoints in production/staging/development/test despite old flags being enabled,
manual-only public config, unauthorized requests/collection, pending conversion,
cash/manual UPI settlement and both auto-print checkbox states.

Both frontend suites cover manual-only checkout/tracking, small loginless orders,
login above the limit, cancelled/pending bills, request failures and replies after
logout. Production builds are regenerated, including desktop frontend-dist. The
responsive browser check intercepts every external request and submits only a
fixture manual request.

This is a local change; it does not publish a desktop release or deploy hosting.

### Local verification results

- Backend: 137 tests passed.
- Web frontend: 116 tests passed (full rerun with two workers; the earlier
  all-builds-at-once run hit one unrelated preview-test timeout).
- Desktop frontend: 84 tests passed.
- Both production frontend builds passed; desktop frontend-dist was regenerated.
- Linux package-file verification passed. No installer build/release was made.
- Browser fixture checks passed at 320, 360, 390, 768, 1280 and 1440px, including
  upload to manual request to pending tracking. No renderer errors or real charges.
- Gateway SDK absent from npm's installed backend dependency graph.
- Both repositories passed git diff --check.
- Real payments, live Supabase mutations and physical printing were not tested.
