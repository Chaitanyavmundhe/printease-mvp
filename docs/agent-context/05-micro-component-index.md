# Micro Component Index

## Backend

### validateManualCollectionMethod
Domain: Backend
Flow: Manual Collection
Future file: backend/src/services/manualCollectionService.js
Current file: backend/src/controllers/orderController.js
Input: method string
Output: CASH | MANUAL_UPI
Risk: invalid method becoming CASH
Tiny task: extract and test

### isPaymentReadyForPrint
Domain: Backend
Flow: Print Queue
Future file: backend/src/services/printJobReadinessService.js
Input: paymentStatus
Output: boolean
Risk: unpaid job released to desktop

### buildAgentJobPayload
Domain: Backend
Flow: Agent Job Payload
Future file: backend/src/services/agentJobPayloadService.js
Input: print job + order files
Output: desktop payload
Risk: missing files[] or wrong signed URL

## Desktop

### normalizeJobFiles
Domain: Desktop
Flow: Job Polling
Future file: desktop-shell/agent/jobFiles.js
Input: backend job payload
Output: file array
Risk: multi-file orders skipped

### buildCupsOptions
Domain: Desktop
Flow: Local Printing
Future file: desktop-shell/printer/cupsOptions.js
Input: printOptions
Output: CUPS args + warnings
Risk: print options ignored

### validateIpcSender
Domain: Desktop
Flow: Electron Security
Future file: desktop-shell/security/ipcSecurity.js
Input: ipc event
Output: boolean
Risk: untrusted renderer uses privileged APIs
