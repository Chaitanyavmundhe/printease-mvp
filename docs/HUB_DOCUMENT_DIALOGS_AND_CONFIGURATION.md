# Hub Document Dialogs and Configuration

Updated: 2026-10-27. Applies to the web and desktop frontends.

## What Was Broken

1. Fixed dialogs lived inside transformed activity/table containers. Their
   effective viewport and scrolling could be constrained by that ancestor.
2. Separate dialogs independently cleared body overflow, unlocking the page while
   another dialog was still open. Some form bodies had only max-height with no
   definite flex height, so their intended scroll area could grow instead.
3. Read-only hub previews inherited the upload dialog's empty settings sidebar.
   Nested document-list and PDF scroll areas wasted space.
4. Every PDF page was rendered into a canvas at once. Long files consumed memory
   and competed with controls and scrolling.
5. Configuration controls emitted flat UI aliases such as scaleMode/printDpi/
   marginMode/sideType, while the backend reads scale.mode/quality.dpi/margins.mode/
   sides. These edits could silently retain the old value after saving.
6. Backend normalization discarded pageOrder/backSideRotation/duplexBinding even
   though the hub editor exposed those controls.
7. A configuration PATCH could succeed, then a follow-up document GET could fail.
   The editor reported the whole operation as failed and encouraged duplicate saves.
8. The editor estimated price per source page rather than the backend's physical
   sheet charge. Invalid ranges silently fell back to all pages.
9. Website deep routes loaded relative JS/CSS from the wrong directory.

## File Responsibilities

- ModalPortal.jsx: portal overlays to document.body, nested scroll locking,
  keyboard focus containment, topmost Escape and focus restoration.
- DocumentPreviewModal.jsx: viewport-sized viewing, proper non-overlay header,
  read-only full-width mode, editable sidebar only when actual settings exist.
  Verified-PDF retrieval and bounded pending-preview retries are unchanged.
- InlineDocumentFrame.jsx: local PDF.js worker; nearby-sheet canvas rendering,
  bounded pixel density, resize-aware width, zoom/fit/sheet navigation. Clamp page
  ranges before iteration and unmount distant canvases. Printing bytes are not
  modified by a preview.
- HubActiveOrdersManager.jsx: document list uses a portal; View opens the shared
  viewer. Configuration PATCH updates local files/order directly from its response.
  Optional later refresh failure cannot change a saved result into a failed save.
- HubHistoryPage.jsx: same read-only viewer and document-list portal. No new
  background history endpoint or conversion request was added.
- hubOrderConfiguration.js: prefill and validate drafts, translate UI settings to
  canonical nested fields, preserve non-edited options and order-file identity,
  interval-based range counting and sheet-price estimates.
- HubOrderConfigModal.jsx: fixed-height flex frame, independently scrollable form,
  visible footer, useful validation errors and stable draft on failed saves.
  Existing print controls and the audit reason remain.
- Backend printOptions.js: preserve only validated advanced options when supplied.
  Do not invent defaults that override ordinary order/printer-profile behaviour.
- Backend orderQueryController.js: return existing preparedPageCount in the
  authorized order document response. No new database column/migration is needed.
- Web package.json/vite.config.js: root-relative web assets for direct deep links.
  Desktop keeps its relative asset base; do not blindly sync these build configs.

## Scope and Preserved Behaviour

The older navbar/dashboard placement is retained. The experimental desktop CSS
from the local review was removed at the user's request. Location retries,
consent-based desktop location sharing and Home startup with saved login remain.

Payment authorization, Razorpay, manual collection, print activation,
cancellation, conversion, early download, agent polling and pairing were not
replaced or disabled. Paid/locked/printing orders remain protected by existing
configuration eligibility rules. No Supabase migration is required.

## Automated Checks

- Frontend configuration tests verify canonical payloads, verified counts,
  no document-ID substitution, range validation, pending pricing and sheet totals.
- Dialog tests verify portal placement, visible validation, failed-save draft
  preservation and nested scroll locks.
- Backend transport test runs the frontend payload through the actual normalizer
  and compares local pricing with the backend calculator.
- Fixture-only browser checks exercise a 40-page converted PDF, wheel scrolling,
  limited live canvases, sheet 40 navigation, multi-file editing, one PATCH,
  no unnecessary second document read and retained configuration on reopen.
- Check viewports: desktop 1300x850/1000x700 and web 1300x850/360x640/320x568.
- Packaged Linux smoke checks cover upload preview, converted PDF preview,
  hub Activity and History previews, local worker loading and missing chunks.
- Backend payment/collection/queue safety tests continue to run.
- Tests use mocked accounts/orders/storage URLs, not live customer data or printers.

Physical printer output, target-machine Windows rendering and device location
services still require manual acceptance testing. A working Linux test is not a
claim that every Windows printer driver or installation was hardware-tested.

