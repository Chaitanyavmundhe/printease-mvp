# Web UI refresh, October 2026

## Agreed scope

Keep the logo, navigation destinations, form settings and payment/printing flow.
Use white/charcoal with teal actions and blue information/focus accents. Improve
readability, modestly increase controls and reduce unused desktop side margins.
The website targets desktop windows and small/older Android screens. This batch
is web-only: no desktop source sync, package build, version bump or release tag.

## Implementation and purpose

- `frontend/src/styles/interface.css`: shared presentation tokens, local system
  font stack, clear focus outlines, reduced-motion support, responsive page width,
  menu bounds, two-column wide settings and three-column short numeric settings.
  Fixed pixel font sizes avoid viewport-driven text scaling. No remote font load.
- `frontend/src/AppRouter.jsx`: shared presentation wrapper and keyboard skip
  link. Route elements, role checks and data props are unchanged.
- `frontend/src/components/Navbar.jsx`: same navigation and profile menu; clearer
  selected state, larger mobile labels, bounded/scrollable menu, responsive header.
- `frontend/src/components/Card.jsx` and `Row.jsx`: restrained panel treatment and
  wrapping summary columns instead of unbreakable labels that squeeze values.
- `HomePage.jsx` and `CentrePriceCard.jsx`: scanner modes participate in layout
  instead of sitting on top of the heading; search controls fit narrow screens;
  primary actions use teal. Camera start/stop/mode persistence is unchanged.
- `UploadPage.jsx`: filenames/actions wrap within their list, configuration
  dialogs fit the viewport with their own scroll area and visible Done button.
  The existing mobile footer stays fixed above the existing bottom navigation.
- `hooks/useBottomBarInset.js`: measures only the footer's rendered height and
  reserves that space below form content, including expanded price details.
  ResizeObserver has resize/details-toggle fallbacks and cleans up on unmount.
  This hook does not read or change prices, uploaded files or order state.
- `components/upload/FileSettingsPanel.jsx`: named/wide choices use two columns;
  Copies, Pages per sheet and Quality (DPI) share a three-column numeric row.
  All original settings/values and setter behavior remain available. Watermark
  controls have accessible names and no implicit extra grid columns on phones.
- `PaymentPage.jsx`: wrapping summary values, clearer pressed payment method,
  consistent actions and spacing. Payment handlers, login gates, validation,
  conversion polling and request eligibility are unchanged.

## Checks

Run frontend unit tests and the web production build:

```bash
npm test --prefix frontend
npm run build --prefix frontend
```

The layout check uses Playwright available on NODE_PATH (or an installed package):

```bash
node frontend/scripts/check-responsive-ui.cjs
```

It serves the real web bundle in an isolated browser and mocks all external
requests. It exercises home, two PDFs, settings, an expanded price footer, the
file configuration dialog and payment-method selection. It never sends a real
document, payment or print request. Viewports: 320x568, 360x640, 390x844, 768x720,
1280x720 and 1440x900. It checks viewport/list clipping, two/three-column layout,
footer/navigation separation, last-setting reachability and renderer errors.
Screenshots and results are written to a temporary folder, not committed.

Completed locally for this batch: 41 frontend tests, production web build, all six
layout viewports above, and the existing local/verified-converted PDF worker smoke
check at desktop, 375px and 320px widths. No renderer errors or unexpected preview
writes were observed. The existing large-vendor-chunk build warning remains;
dependency/chunking changes are outside this visual refresh.

Mobile footer follow-up: the fixed upload actions use a neutral light-grey background,
stronger top divider and upward shadow, distinct from the white scrolling form.
Its inner summary is transparent on mobile so it cannot hide that separation.
Position, buttons, footer measurement and desktop summary styling are unchanged.
The layout smoke check asserts this visual distinction as well as non-overlap.
The neutral shade replaces the initial blue-grey based on user feedback; teal
buttons and the rest of the selected website palette remain unchanged.

Payment action follow-up: on mobile, Request Payment (and the existing selected
online/QR action) is fixed above bottom navigation, not merely sticky near the
end of the form. The shared measured-inset hook reserves its real height. It
disconnects when a cancelled order has no action bar. Desktop keeps its existing
in-page button. Eligibility, disabled states, callbacks and payment APIs are
unchanged. Browser checks assert a stable position while scrolling and that the
manual-payment notice remains reachable above the fixed bar.
This follow-up passed 42 unit tests, the web build and all six layout viewports.

## Checkout, history and centre-discovery follow-up

- `components/payment/CheckoutSummary.jsx` keeps centre, document(s), selected
  pages/copies, per-file prices and total visible. Secondary single-file print
  facts remain under Print details. Unknown facts are not filled with defaults.
  This component does not calculate totals or aggregate the first file's count
  as if it were the whole multi-file order.
- `PaymentPage.jsx` removes repeated instructions, the internal Cash Collected
  button reference and a misleading verification-shield decoration. Centre UPI
  details show only for manual payment and only when supplied. Online QR stays
  a separate payment method. Pending/failed/cancelled and login/payment guards,
  polling and callbacks are retained.
- `HistoryPage.jsx` shows Orders, Pages and Spent in one row below 768px; Last
  Print Date is hidden there, not removed from server data or desktop layouts.
- `HubDesktopDownload.jsx` supports a visible header button on the web hub home
  and dashboard, not just the profile menu. Download Windows App requests the
  latest stable GitHub EXE on click using the existing trusted URL resolver.
  Normal users and the Electron app never see this button. No version is pinned.
- `CentreSortControl.jsx`, `useCentreSort.js` and `utils/centreSort.js` share sort
  options and a validated browser preference across Home and Centre Code. Nearest
  is unavailable without location; the hook never stores coordinates.
- `centreDiscovery.js` makes explicit price/name/distance/usage choices primary;
  availability no longer silently overrides Lowest price. Separate single/double
  B/W/colour price options compare the advertised rate. Missing/nonpositive/invalid
  prices sort last and display Pending on centre cards, never zero as a low price.
  Recommended retains availability, nearby distance buckets, usage/recency, then
  price. Stable distance buckets avoid non-transitive comparisons. One order is
  counted once even when it carries both centre ID and code. Missing coordinates
  stay unknown, not (0,0); numeric centre codes remain searchable.

The browser test additionally verifies real list reordering, saved sort between
pages, numeric/code searches, the compact history row and a mocked latest Windows
EXE download from the visible hub dashboard button. All API requests are isolated
fixtures; no live payment, upload or print request is made. The scanner has not
been changed in this follow-up; its existing transparent behavior is retained.

Validation for this follow-up: 62 frontend tests, production web build, the six
responsive/browser scenarios plus visible hub Windows download, and the existing
three-size local/converted PDF worker checks passed. The Windows resolver was
also checked against GitHub's actual latest release. No backend/Supabase change,
desktop build, desktop source sync or release tag is part of this batch.

Physical Android devices, system keyboards, real transactions and screen-reader
compatibility still need human checks. No claim of full accessibility certification
or old-browser compatibility is made by a Chromium viewport test alone.

## Deployment and guardrails

Only commit the reviewed web source, tests and this document. Push small checked
batches to the web repository's main branch; inspect Vercel's deployment status.
Do not tag/build a desktop release for these web UI changes. Do not copy backend
code or environment files. Both desktop source and its running agent remain alone
until the user approves a separate desktop UI update.
