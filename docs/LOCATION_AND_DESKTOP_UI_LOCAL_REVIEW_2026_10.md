# Location Detection and Local Desktop Review

Date: 2026-10-27. Historical local-review notes.

Superseded UI decision: the user chose the older navbar/dashboard placement
for release 0.1.115. The experimental wide-table/navigation CSS described below
was removed, not published. Location and Home-startup fixes were retained.
See HUB_DOCUMENT_DIALOGS_AND_CONFIGURATION.md for the final dialog changes.

## Why location could fail

- Hub settings previously attempted high-accuracy positioning only. Desktop PCs
  without a GPS/provider could immediately return POSITION_UNAVAILABLE.
- The map request had no explicit deadline and displayed every failure as a
  permission denial, including unavailable providers and timeouts.
- Electron does not inherit a normal browser's working location provider just
  because its permission handler allows geolocation. Its documented built-in
  provider requires separate Google API configuration:
  https://github.com/electron/website/blob/main/docs/latest/api/environment-variables.md
- A provider failure is not evidence of a backend or Supabase failure. No schema,
  secrets, backend routes, payment rules or printer logic were changed.

## Shared frontend changes

- `frontend/src/utils/location.js`: validate coordinates, try a network/cached
  fix first (8 seconds), then high accuracy (12 seconds) for unavailable/timeout
  only. A JavaScript watchdog bounds providers that never invoke callbacks.
  Permission denial is not retried. Cancellation ignores late results.
- `frontend/src/hooks/useUserLocation.js`: share the current position with centre
  ranking and the map, automatically request only with an existing permission
  grant, and clear position on permission revocation. No persistent customer
  coordinate storage or PrintEase-server submission was added.
- `App.jsx`: use the shared hook rather than maintaining a different request flow.
- `CentreMapModal.jsx`: bounded detection, accurate failure feedback, cancellation
  on close and shared customer-position updates. Public centre markers remain.
- `HomePage.jsx` and `CentreCodePage.jsx`: pass the shared request to the map.
- `HubLocationCard.jsx`: reuse detection, validate finite coordinates/ranges
  before saving, and retain explicit Save before publishing a shop location.
  Zero latitude/longitude are valid and are not treated as missing.
- Website `CentreLocationActions.jsx`: provide actionable error text as well as a
  compact button status.
- Shared logic and tests were added to both frontends without running a wholesale
  frontend sync. Their intentional desktop/web layout differences remain.

## Desktop browser fallback

Only an explicit location click opens the system browser. Background permission
checks never open a tab. The desktop preload exposes only request/cancel methods;
the renderer cannot choose a URL, port, executable or command.

`desktop-shell/src/services/location/browserLocation.js`:
- Temporary HTTP listener bound to 127.0.0.1 on an OS-assigned port.
- Cryptographically random one-use path; exact Host and POST Origin checks.
- JSON-only callback, 2 KB body limit, finite coordinate/accuracy validation.
- The page requires an explicit Share location click and browser permission.
- No remote scripts, coordinate logs, API keys or backend relay.
- No-store responses, nonce-based CSP, framing protection and no-referrer policy.
- 90-second deadline and cleanup on completion, cancellation or browser failure.

`desktop-shell/src/ipc/systemIpc.js` uses the existing trusted-renderer wrapper,
also requires a top-level app window, limits sharing to one pending request, and
cancels when the app/window/renderer exits. Preload changes are in `preload.cjs`.

The user returns to PrintEase after sharing; the browser tab is not forcibly
closed. Shop coordinates remain a draft until Save. An installed browser and
working OS/browser location services are still required. This is not a GPS
emulator or an IP-derived guess. A malicious process already running as the same
OS user is outside this local handoff's protection boundary.

Map tiles remain third-party OpenStreetMap requests. Tile providers can infer
the viewed area and see the request IP; "not saved by PrintEase" does not mean
that an external map provider receives no network metadata.

## Desktop landing page and visual review

- `desktop-shell/src/frontendLoader.js` loads Home (`#/`) for packaged,
  local-built, development and fallback startup paths. It does not clear auth,
  alter login redirects, reset navigation during normal use or stop agent loops.
- Desktop-only CSS lives in `frontend/src/styles/desktop-review.css`, scoped by
  classes in `AppRouter.jsx`. The website layout is not overwritten.
- Navigation remains one horizontal row, with 18px labels (+4px). Narrow windows
  scroll the navigation horizontally instead of removing links.
- Hub content uses small side margins. The activity table retains all eight
  columns, its original text/control sizes, order actions and Auto-print checkbox.
  At small desktop widths the table can scroll rather than overlap.
- Location/banner tools use clearer headings, input sizing, focus styles and
  8px frames. Every existing setting remains available. No forced collapse or
  change to banner insertion, payment, conversion or printing behaviour.
- The reported LibreOffice error was explicitly excluded from this task.

## Verification

Passed before local review:
- Website frontend: 89 tests.
- Desktop frontend: 57 tests, including all navigation destinations, persisted
  Auto-print checkbox, all table headings and existing banner type controls.
- Four Node tests for local handoff privacy, origin/host/token validation,
  invalid coordinates, cancellation, timeouts and browser-launch failure.
- Both frontend production builds; desktop frontend-dist rebuilt.
- Desktop package verification and changed main-process/preload syntax checks.
- Playwright layout checks at 1000x700, 1280x800, 1440x900 and 1920x1080.
  No real backend writes, payment requests or print jobs during these checks.
- Real Chromium browser handoff with fixture geolocation; Electron startup loader
  returns to Home and preserves fixture localStorage across a fresh load.

These tests do not prove that the physical device's GPS/network provider works.
Physical-device location testing still needs the user to grant permission.
No Windows installer or Linux release package was built for this local UI task.

## Manual review

1. Reload the local web preview after the new frontend build.
2. On web, allow location in site settings and enable OS location/Wi-Fi. Request
   location and check ranking/map; denial, unavailable and timeout must differ.
3. On desktop, click Use Current Location, then Share location in the browser.
   Return to the app: coordinates should be filled, but not published until Save.
4. Cancel/close the page or wait for expiry: the app must allow retry.
5. Reopen desktop: Home should open, with the existing login/session retained.
6. Review navigation, all table columns, Auto-print after cash collected and every
   banner setting. No production payment or print is needed for visual review.
