# PrintEase Architecture & Developer Guide

## System Overview

PrintEase operates on a dual-repository architecture designed to support a seamless Web MVP and a native Desktop Hub Client.

### 1. Web MVP (`printease-mvp`)
The core cloud infrastructure that powers the user-facing web app and the centralized backend API.
- **Frontend**: React + Vite + TailwindCSS. Deployed on Vercel.
- **Backend**: Node.js + Express. Deployed on Render.
- **Database**: PostgreSQL (hosted on Supabase), accessed via `pg`.
- **Storage**: Supabase Storage for secure PDF uploads.

### 2. Desktop Client (`printease-desk`)
A native desktop application for print hub owners, acting as a secure bridge between the cloud backend and local printers.
- **Shell**: Electron + Node.js (with `pdf-to-printer` / `unix-print` for CUPS support).
- **Frontend**: Synced directly from `printease-mvp/frontend`. This ensures the UI remains identical across web and desktop without duplicating business logic.
- **Sync Script**: Uses `sync-shared-frontend.sh` to pull UI updates from the MVP repository before packaging.

---

## Security Architecture

PrintEase is hardened against common web and financial exploits.

### 1. Database Security
All queries in `src/db/repository.js` use strictly parameterized inputs via the PostgreSQL `$1, $2` syntax. This eliminates the risk of SQL injection.

### 2. File Upload Integrity
- **Size Limits**: Multer restricts in-memory uploads to 10MB to prevent DoS attacks.
- **Magic Byte Validation**: `looksLikePdf` strictly verifies the `%PDF-` header. Malicious executables masked as `.pdf` files are rejected.
- **Page Counting**: The backend calculates the exact page count natively using `pdf-lib`. The client cannot spoof page counts to manipulate pricing.

### 3. Financial Security
- **Server-Side Pricing**: Order prices are locked down on the server. `calculatePrintPricing()` uses the database-verified page count and the hub's specific pricing configuration.
- **Webhook Verification**: Payment gateways (Razorpay) require cryptographic HMAC signature verification before an order's payment status is updated.

### 4. Rate Limiting
Express handles reverse proxies correctly (`app.set('trust proxy', 1)`), allowing rate limiters (`express-rate-limit`) to accurately track clients by their true IP, preventing brute-force login and upload attacks.

---

## Desktop App Synchronization

The Desktop application embeds the exact same React frontend used in the Web MVP. 

To sync updates from the MVP to the Desktop app, navigate to the `printease-desk` repository and run:
```bash
./sync-shared-frontend.sh mvp-to-desk --apply
```
This script safely copies the latest React components, pages, and configurations into the Desktop shell, ignoring repository-specific configs (like `.git` and `vercel.json`).

### Building the Desktop Release
We use `electron-builder` to package the synced frontend and the Electron shell into a distributable file.

- **Linux AppImage**: `npm run dist:appimage`
- **Windows Exe**: `npm run dist:win`

All releases are automated via GitHub Actions when a tag matching `desktop-v*` is pushed to the `printease-desk` repository.

---

## QR Code Scanning
The Web and Desktop apps use `jsQR` to process camera frames natively on a hidden canvas. This provides excellent cross-browser compatibility (including iOS Safari and Firefox) where the native `BarcodeDetector` API is unsupported.
