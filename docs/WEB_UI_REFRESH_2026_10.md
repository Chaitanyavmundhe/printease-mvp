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

## Live search and compact discovery follow-up

- `HomePage.jsx` places Ready / Transparent / Classic together directly below
  their scanner, with equal-width 44px controls rather than a floating corner
  strip. The requested paragraph below Print documents securely and the extra
  timeout badge are removed. Camera mode values, persistence, permission handling,
  the 30-second stop timer and QR-to-upload selection are unchanged.
- `CentreSearchField.jsx` is reused by Home and Centre Code. Results update from
  the loaded public centre list on every edit; Enter dismisses the keyboard and
  leaves results on the same page. Clear restores the list. Search Online and
  its obsolete enter-to-redirect callback were removed; QR/deep-link code lookup
  still uses the existing server lookup. This avoids a request for every keystroke.
- `utils/centreSearch.js` uses pinned Fuse.js 7.5.0 for name/area spelling mistakes
  (including swapped letters). Public names/areas alone are fuzzy-indexed; numeric
  codes, price ceilings and availability filters remain literal/strict. Unrelated
  searches still show no matches, not invented centres. No query service, analytics
  or coordinate upload is introduced. See the [Fuse fuzzy-search reference](https://www.fusejs.io/fuzzy-search.html).
- `centreDiscovery.js` now prioritises relevance, then actual distance in
  Recommended when the user has granted location. Availability, usage, recency and
  known rates break ties; centres with no shared coordinates sort after known
  distances. This supersedes the earlier availability-first/distance-bucket rule.
  Explicit saved price/name/availability sorts remain respected. Existing App
  permission detection fetches the position only when already granted or tapped;
  coordinates stay in memory and are not sent in discovery API requests.
- `CentreLocationActions.jsx` keeps Use my location / View centres on map side
  by side on both discovery screens. Map is disabled when no result has shared
  its coordinates. Denied/unsupported location does not block search or upload.
- `CentreCodePage.jsx` displays two centre cards per row, including at 320px.
  Its compact card variant keeps name, code, distance/area, availability, map,
  four A4 rates and Upload. Long UPI details stay in the existing full Home card
  and payment view rather than overflowing narrow search cards. Pending rates
  remain Pending. The upload callback and selected centre are unchanged.
- `interface.css` changes the main print settings to three equal columns with
  three short numeric controls. At 320px, Orientation spans two tracks so its
  Landscape value stays readable; Margins fills the matching two-track space.
  Margins otherwise uses a full row and watermark details keep full rows.
  Values, setters, print payloads, payment, conversion, printing and early
  download logic are not changed. All controls retain at least 44px height.

Tests cover fuzzy/exact/code/price/availability/non-Latin search, nearest-first
ranking, explicit sort overrides and no navigation on Enter. The browser fixture
grants location without transmitting it and checks the actual reordered list,
two-card grid, side-by-side map/location actions, clear/type/Enter search, scanner
control placement and three-column settings across six viewports. It also checks
selected option text fits, modal/footers, payment and history regressions. All
external requests are mocked; no real orders, payments or prints are submitted.

Completed validation: 72 frontend tests, the production web build, six responsive
browser viewports, the new-visitor location-permission check, and three-size
local/verified-converted PDF preview checks all passed. No renderer errors were
observed. Physical older Android devices and the system keyboard still need
manual checks. This remains web-only; desktop source and release tags are unchanged.

## Shorter scan-page cards

The two-column scan results were too tall because every rate put its label above
the amount and Map occupied a separate full row. `CentrePriceCard.jsx` now keeps
the full centre name first and aligns each of the four rate labels beside a bold
amount. A single A4 rates / page caption retains the currency unit information
without repeating /page four times. Invalid/unknown amounts still read Pending.

Compact-card availability, distance/location and account usage sit below rates.
The centre code is retained. Map is a labelled, tooltip-equipped icon button next
to Upload; both retain 44px touch targets. No names, amounts or metadata are hidden
or line-clamped. Long names, Pending and larger prices may use more height to keep
their full content readable. Existing full Home cards keep their original rates,
UPI details and map/upload labels. No selection, search, payment, conversion,
printing, agent or early-download handlers have changed.

Unit tests assert all compact details and both action callbacks, including the
offline/missing-location/Pending case. The responsive test checks four visible
rate rows, label/amount separation, one-row accessible actions and a 350px height
budget for a normal short-name card at mobile widths. It retains all existing
six-viewport upload, payment, history and discovery regression checks.
Validation passed: 74 frontend tests, production web build and all six browser
viewports. The 320px and 390px screenshots were visually inspected. No backend
or desktop source/build/release changes are included.

Centre-code placement follow-up: scan cards now put the code before the name in
the same heading instead of reserving a separate Code row. The name remains the
larger, bold text; code and name wrap naturally without truncation. Screen readers
retain the Centre code label. Full Home cards keep their separate labelled code.
