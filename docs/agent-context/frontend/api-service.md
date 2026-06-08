# API SERVICE

## File paths
`frontend/src/services/api.js`

## Responsibility
Serves as the primary HTTP client for the frontend to communicate with the PrintEase backend. It provides utility functions like `apiRequest` and specialized wrappers like `getUserHistory`.

## Owns
- Central API base URL configuration (handling local vs production).
- Automatic injection of the JWT bearer token (`printease_token`).
- Centralized error handling (`ApiError`).
- URL joining and normalizing.

## Does not own
- Request caching logic (delegated to `requestCache.js`).
- Business logic or state management (delegated to React components).

## Important functions
- `apiRequest(endpoint, options)`: The core fetch wrapper.
- `getUserHistory({ force, userId })`: Wraps `apiRequest` with `getCachedJson` to prevent spamming the backend for history loads.
- `invalidateUserHistory(userId)`: Clears the cache for a specific user's history.

## Inputs
- Endpoint strings, standard `fetch` options objects.

## Outputs
- JSON parsed response payloads or typed `ApiError` objects.

## Side effects
- Reads from `localStorage` for authentication tokens.

## API/database calls
- Directly makes HTTP `fetch` requests to the backend.

## Security rules
- Always uses `Authorization: Bearer <token>` if present.
- Strictly ignores untrusted frontend `VITE_API_URL` values if not local, to prevent hijacking to malicious backends.

## Known risks
- Fetching large payloads without pagination can cause memory spikes.

## Reusable helper extraction ideas
- Request interceptors for 401 Unauthorized handling could be added.

## Safe to edit
- Yes, adding new wrapper endpoints (like `getUserHistory`) is safe.

## Do not edit
- Do not edit the core `apiRequest` headers logic without extreme caution, as it could break authentication site-wide.

## Related flow docs
N/A

## Related contract docs
- error-codes.md
