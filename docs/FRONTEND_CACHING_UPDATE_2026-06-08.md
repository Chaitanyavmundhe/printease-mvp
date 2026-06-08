# Frontend Caching & Event System Update (2026-06-08)

## Overview
To drastically reduce redundant backend API calls (particularly `/api/user/history`), a new lightweight caching and eventing strategy was implemented on the frontend. This prevents the `HistoryPage` from spamming the backend whenever unrelated state changes occur in the main `App.jsx` component.

## Key Changes

### 1. `requestCache.js` (NEW)
- Location: `frontend/src/services/requestCache.js`
- Provides an in-memory GET request deduplicator and TTL cache.
- The `getUserHistory` API wrapper now intercepts requests with a 2-minute TTL, avoiding repeated network traffic during rapid tab-switching or unrelated order actions.

### 2. `appEvents.js` (NEW)
- Location: `frontend/src/utils/appEvents.js`
- A lightweight Pub-Sub emitter.
- Eliminates the need for global state prop-drilling (`lastUpdatedAt`) simply to signal secondary components to reload.
- Now, when an order is created or a payment is verified, `App.jsx` fires `emitOrderChanged()`.
- `HistoryPage` subscribes to this event and performs a soft/cached refresh.

### 3. `HistoryPage.jsx` Decoupling
- Fully decoupled from the `lastUpdatedAt` dependency array.
- Now features a "Refresh" button for manual hard-reloads.
- Includes a passive `window.focus` listener that softly checks if the cache has expired upon returning to the app.

### 4. Duplicate Payment Request Guard
- Implemented a short-circuit guard in `App.jsx -> handlePayment()` to prevent sending duplicate manual payment requests to the backend if an identical pending request is already locally queued.

### 5. Backend Header Injection
- `userController.js` now attaches `Cache-Control: private, max-age=60` to the history payload to assist browser-level caching.

## Result
User history pages now load once per 2-minute window. Heavy order/payment operations no longer crash or overwhelm the backend by forcing background components to constantly request their full history payloads.
