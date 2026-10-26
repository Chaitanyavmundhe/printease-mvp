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

Physical Android devices, system keyboards, real transactions and screen-reader
compatibility still need human checks. No claim of full accessibility certification
or old-browser compatibility is made by a Chromium viewport test alone.

## Deployment and guardrails

Only commit the reviewed web source, tests and this document. Push small checked
batches to the web repository's main branch; inspect Vercel's deployment status.
Do not tag/build a desktop release for these web UI changes. Do not copy backend
code or environment files. Both desktop source and its running agent remain alone
until the user approves a separate desktop UI update.
