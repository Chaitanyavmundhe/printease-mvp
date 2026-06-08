# Micro Component Index

## Backend

### validateManualCollectionMethod
Domain: Backend
Flow: Manual Collection
Current file: backend/src/services/manualCollectionService.js
Called by: backend/src/controllers/orderController.js
Input: method string
Output: CASH | MANUAL_UPI
Risk: invalid method becoming CASH
Tiny task: split into exported pure `validateManualCollectionMethod(rawMethod)` and test invalid/cash/manual_upi

### isPaymentReadyForPrint
Domain: Backend
Flow: Print Queue
Current file: backend/src/services/printJobReadinessService.js
Input: paymentStatus
Output: boolean
Risk: unpaid job released to desktop
Tiny task: keep payment-ready logic pure and reusable

### buildAgentJobPayload
Domain: Backend
Flow: Agent Job Payload
Current file: backend/src/services/agentJobPayloadService.js
Input: print job + order files
Output: desktop payload
Risk: missing files[] or wrong signed URL
Tiny task: keep signed URL creation backend-only and preserve `files[]`

## Desktop

### normalizeJobFiles
Domain: Desktop
Flow: Job Polling
Current file: printease-desk/desktop-shell/agent/jobPoller.js
Future file: printease-desk/desktop-shell/agent/jobFiles.js
Input: backend job payload
Output: file array
Risk: multi-file orders skipped

### buildCupsOptions
Domain: Desktop
Flow: Local Printing
Current file: printease-desk/desktop-shell/printer/linuxCups.js
Future file: printease-desk/desktop-shell/printer/cupsOptions.js
Input: printOptions
Output: CUPS args + warnings
Risk: print options ignored

### validateIpcSender
Domain: Desktop
Flow: Electron Security
Current file: printease-desk/desktop-shell/main.js
Future file: printease-desk/desktop-shell/security/ipcSecurity.js
Input: ipc event
Output: boolean
Risk: untrusted renderer uses privileged APIs
