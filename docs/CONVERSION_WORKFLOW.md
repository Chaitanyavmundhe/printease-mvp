# PrintEase — Document Conversion & Pricing Workflow

> **Last updated:** June 2026
> This document describes the full lifecycle of how user-uploaded files are
> converted, priced, and printed across the Frontend, Backend, and Desktop Agent.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Type Classification](#file-type-classification)
3. [Stage 1: Browser Preparation (Frontend)](#stage-1-browser-preparation-frontend)
4. [Stage 2: Upload & Order Creation (Frontend → Backend)](#stage-2-upload--order-creation-frontend--backend)
5. [Stage 3: Hub Desktop Conversion (Desktop Agent)](#stage-3-hub-desktop-conversion-desktop-agent)
6. [Stage 4: Backend Verification (Backend)](#stage-4-backend-verification-backend)
7. [Stage 5: User Price Confirmation](#stage-5-user-price-confirmation)
8. [Stage 6: Print Execution (Desktop Agent)](#stage-6-print-execution-desktop-agent)
9. [UX States & Progress Indicators](#ux-states--progress-indicators)
10. [Security Model](#security-model)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                            │
│                                                                  │
│  PDF/Image/Text → Browser converts to PDF instantly              │
│  DOCX/PPTX/XLSX → Marked as PENDING_DESKTOP                     │
│                    (shows pending bill notice; no fake price)     │
│                                                                  │
│  Upload original file + metadata to Backend                      │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                         BACKEND (Render)                          │
│                                                                  │
│  • Stores original file in Supabase                              │
│  • Creates order with status awaiting_hub_bill_confirmation      │
│  • Marks document as requiresDesktopPreparation = true           │
│  • Keeps page count and amount pending until PDF verification    │
│  • Does NOT convert Office files (no LibreOffice on Render)      │
│                                                                  │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    HUB DESKTOP AGENT (Electron)                   │
│                                                                  │
│  Polls GET /agent/jobs/predownload                               │
│  Sees document with preparationStatus = 'pending'                │
│                                                                  │
│  1. Downloads original file from Supabase signed URL             │
│  2. Converts to PDF using BUNDLED LibreOffice headless           │
│  3. Counts pages locally (pdf-lib)                               │
│  4. Uploads converted PDF + page count to Backend via FormData   │
│     POST /agent/preparation-result                               │
│                                                                  │
│  Cache: Keeps local PDF copy for print step (no re-download!)    │
│                                                                  │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND VERIFICATION                           │
│                                                                  │
│  Receives PDF from agent, INDEPENDENTLY verifies:                │
│  ✓ Valid PDF (not corrupt/malicious)                             │
│  ✓ Page count (pdf-lib, ignores agent's reported count)          │
│  ✓ SHA256 hash                                                   │
│  ✓ Stores in Supabase (hub-converted/ bucket path)              │
│                                                                  │
│  Updates document: prepared_page_count, print_ready_storage_path │
│  Recalculates order pricing with VERIFIED page count             │
│                                                                  │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    USER SEES FINAL PRICE                          │
│                                                                  │
│  Frontend polls or receives update:                              │
│  • Real page count + exact price shown                           │
│  • Pending manual payment request can continue after bill verify │
│                                                                  │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PRINT EXECUTION                                │
│                                                                  │
│  Agent uses SAME local cached PDF (no re-download from backend)  │
│  Sends to local printer → reports completed                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## File Type Classification

Handled in `frontend/src/utils/filePreparation/detectUploadFileKind.js`:

| Kind         | Extensions                     | Browser Conversion | Desktop Needed |
|--------------|--------------------------------|-------------------|----------------|
| `pdf`        | .pdf                           | ✅ Native (count only) | No         |
| `image`      | .jpg, .jpeg, .png, .gif, .bmp, .webp, .tiff, .svg | ✅ Wraps in PDF | No |
| `text`       | .txt, .csv, .log, .md          | ✅ Renders to PDF | No             |
| `office`     | .docx, .pptx, .xlsx, .doc, .ppt, .xls, .odt, .ods, .odp | ❌ Cannot | **Yes** |
| `archive`    | .zip, .rar, .7z                | ❌ Cannot          | **Yes**        |
| `unsupported`| everything else                | ❌ Cannot          | **Yes**        |

---

## Stage 1: Browser Preparation (Frontend)

**File:** `frontend/src/utils/filePreparation/prepareUploadPreview.js`

When user selects files in the upload form:

```
For each file:
  detectUploadFileKind(file)
    ├─ 'pdf'    → Count pages with pdf-lib         → status: READY
    ├─ 'image'  → Convert to PDF (canvas-based)    → status: READY
    ├─ 'text'   → Render to PDF (custom renderer)  → status: READY
    └─ 'office' → Cannot convert in browser         → status: PENDING_DESKTOP
```

**PENDING_DESKTOP** means:
- Page count is unknown (null)
- Price shows "Pending"
- A loading/progress indicator is shown
- Notice: "DOCX, PPTX, XLSX formats will be converted by the print hub after Continue."
- User CAN still proceed to upload/checkout — the price will be confirmed once the hub converts it

---

## Stage 2: Upload & Order Creation (Frontend → Backend)

**File:** `frontend/src/App.jsx` → `preparePayment()`

```
1. For each file:
   a. If printReadyFile exists (browser converted) → upload that as 'document'
   b. If PENDING_DESKTOP → upload ORIGINAL file + requiresDesktopPreparation=true

2. POST /api/uploads (FormData with file)
3. POST /api/orders (JSON with documentIds, print options, etc.)
4. Backend responds with order + verified price or pending bill state
   - For PENDING_DESKTOP files, page count and amount stay pending
   - No fallback "1 page" or "₹1" price is allowed
5. Navigate to payment page
```

---

## Stage 3: Hub Desktop Conversion (Desktop Agent)

**File:** `printease-desk/desktop-shell/agent/jobPoller.js` → `predownloadPendingDocuments()`

The desktop agent polls for files needing conversion:

```
1. GET /agent/jobs/predownload → receives files list
2. For each file with requiresDesktopPreparation && preparationStatus === 'pending':
   a. Download original file from Supabase signed URL
   b. Run preparePrintFile() which calls:
      - detectFileKind() → determines conversion strategy
      - convertOfficeToPdf() → LibreOffice headless --convert-to pdf
      - convertImageToPdf() → For image files
      - convertTextToPdf() → For text files
   c. Read converted PDF with pdf-lib → count pages
   d. Build FormData with:
      - documentId, preparationStatus, preparedPageCount
      - printReadyFile (the actual PDF binary)
   e. POST /agent/preparation-result (FormData)
   f. KEEP local cache of converted PDF for later printing
```

**Key:** The converted PDF is **cached locally** by the agent. When it's time to print,
the agent uses this cached copy instead of re-downloading from the backend.

---

## Stage 4: Backend Verification (Backend)

**File:** `backend/src/services/documentVerificationService.js`
**File:** `backend/src/controllers/agentController.js` → `reportPreparationResult()`

```
1. Receive FormData with printReadyFile (PDF buffer) from agent
2. Verify PDF:
   a. Load with pdf-lib → validates it's a real PDF
   b. Count pages → this becomes the AUTHORITATIVE page count
   c. SHA256 hash the buffer
3. Upload to Supabase (hub-converted/ path)
4. Update document record:
   - prepared_page_count = VERIFIED count (not agent's count)
   - print_ready_storage_path
   - print_ready_sha256
   - preparation_status = 'prepared'
5. Recalculate order pricing using VERIFIED page count
```

**CRITICAL RULE:** Backend NEVER trusts the agent's `preparedPageCount`.
It independently loads the PDF and counts pages itself.

---

## Stage 5: User Price Confirmation

After the backend updates the document's preparation status:

```
Frontend (polling or websocket update):
  - preparationStatus changes from 'pending' → 'prepared'
  - Real page count is now available
  - Price recalculated with verified data
  - User sees exact final price
  - Backend can move the order to bill_confirmed
```

---

## Stage 6: Print Execution (Desktop Agent)

**File:** `printease-desk/desktop-shell/agent/jobPoller.js` → `processNextJob()`

After user pays:

```
1. Agent polls GET /agent/jobs/next → receives print job
2. For each file in the job:
   a. Check local cache first (findCachedDocument)
      - If cached → USE LOCAL COPY (no re-download!)
      - If not cached → download from Supabase signed URL
   b. Run preparePrintFile() (may be a no-op if already PDF)
   c. Send to local printer via printFile()
3. Report job completed
4. Clean up cached files
```

**Key optimization:** Since the agent already converted the file in Stage 3
and cached it locally, it does NOT need to re-download the PDF from the backend.
The same local file is reused for printing.

---

## UX States & Progress Indicators

### Upload Page States

| State | Badge Color | Message | Progress Bar |
|-------|------------|---------|--------------|
| PREPARING | Amber | "Converting and counting your selected files." | ✅ Animated |
| READY | Emerald | "X pages ready" | Hidden |
| PENDING_DESKTOP | Amber | "Ready for hub conversion" | ✅ Pulsing |
| FAILED | Rose | Error message | Hidden |

### Office File Notice (shown when DOCX/PPTX/XLSX detected)

```
⚠️ Office document preparation
DOCX, PPTX and XLSX files are being converted to PDF format by the
print hub's desktop agent after you continue. This usually takes
10-30 seconds depending on file size. You'll see the exact price once
backend verification completes.
```

### Price Display During PENDING_DESKTOP

- **Estimate column:** Shows "Pending" (not "₹0")
- **Status column:** Shows "Converting..." with pulsing dot
- **Total:** Shows "Pending" until all files are converted
- **Button:** Shows "Continue for hub bill" — user can proceed
  (backend will hold the order until conversion completes)

---

## Security Model

```
┌────────────────────────────────────────────────────┐
│                 TRUST BOUNDARIES                    │
│                                                    │
│  Browser  → UNTRUSTED (can be manipulated)         │
│  Agent    → SEMI-TRUSTED (runs on hub's machine)   │
│  Backend  → TRUSTED (source of truth for pricing)  │
│                                                    │
│  Rule 1: Backend ALWAYS recounts PDF pages itself  │
│  Rule 2: Backend ALWAYS recalculates price itself  │
│  Rule 3: Agent can convert, but never set price    │
│  Rule 4: Browser estimates are for UX only         │
└────────────────────────────────────────────────────┘
```

---

## Related Files

### Frontend
- [`detectUploadFileKind.js`](../frontend/src/utils/filePreparation/detectUploadFileKind.js) — File type classification
- [`prepareUploadPreview.js`](../frontend/src/utils/filePreparation/prepareUploadPreview.js) — Browser-side preparation
- [`prepareBrowserPrintReadyFile.js`](../frontend/src/utils/filePreparation/prepareBrowserPrintReadyFile.js) — Browser PDF conversion
- [`UploadPage.jsx`](../frontend/src/pages/UploadPage.jsx) — Upload UI with progress states

### Backend
- [`documentVerificationService.js`](../backend/src/services/documentVerificationService.js) — PDF verification & storage
- [`agentController.js`](../backend/src/controllers/agentController.js) — Agent API endpoints
- [`agentRoutes.js`](../backend/src/routes/agentRoutes.js) — Route definitions with multer

### Desktop Agent (printease-desk)
- [`jobPoller.js`](../../printease-desk/desktop-shell/agent/jobPoller.js) — Job polling, predownload, print execution
- [`conversionEngine.js`](../../printease-desk/desktop-shell/agent/printPreparation/conversionEngine.js) — LibreOffice detection (bundled + system)
- [`officeToPdf.js`](../../printease-desk/desktop-shell/agent/printPreparation/officeToPdf.js) — LibreOffice headless conversion
- [`preparePrintFile.js`](../../printease-desk/desktop-shell/agent/printPreparation/preparePrintFile.js) — File preparation router
- [`download-libreoffice.js`](../../printease-desk/desktop-shell/scripts/download-libreoffice.js) — Pre-build LibreOffice bundling script
