# Risky Files

These files control critical boundary or business logic. Treat them with extreme caution.

## Backend
- `backend/src/controllers/orderController.js`: Manages order creation, pricing calculation, and collection logic. High risk of incorrect billing.
- `backend/src/controllers/agentController.js`: Manages agent pairing and JWT tokens.
- `backend/src/services/printQueueService.js`: Gates document access based on payment verification.

## Desktop
- `desktop-shell/main.js`: Controls Electron security primitives (CSP, window isolation, IPC).
- `desktop-shell/agent/jobPoller.js`: Background printing loop. Bugs here will result in infinite loops or skipped prints.
- `desktop-shell/printer/linuxCups.js` & `windowsPrinter.js`: Raw OS execution. High risk of shell injection if inputs aren't sanitized.
