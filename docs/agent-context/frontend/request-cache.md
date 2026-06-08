# REQUEST CACHE

## File paths
`frontend/src/services/requestCache.js`

## Responsibility
Provides an in-memory caching layer with TTL (Time-To-Live) support and in-flight request deduplication to prevent duplicate backend HTTP requests.

## Owns
- Local Map structures tracking cached payloads and in-flight Promises.
- Cache hit/miss evaluation based on TTL constraints.

## Does not own
- The actual HTTP fetch implementation (delegated to the caller, e.g. `api.js`).
- Persistent storage (does not use localStorage/sessionStorage).

## Important functions
- `getCachedJson(key, fetcher, options)`: Returns cached data if valid, otherwise invokes `fetcher()`. De-duplicates concurrent calls for the same `key`.
- `invalidateCache(key)`: Deletes a single key from the cache.
- `invalidateCachePrefix(prefix)`: Deletes all keys starting with a prefix.
- `clearRequestCache()`: Wipes the entire cache.

## Inputs
- `key` (string), `fetcher` (Promise-returning function), `options` ({ ttlMs, force }).

## Outputs
- Data returned by the `fetcher`.

## Side effects
- Stores data in module-level scope variables (`cache`, `inFlightRequests`).

## API/database calls
- Executes the provided `fetcher()` which typically makes backend calls.

## Security rules
- Does not cache sensitive POST requests or signed URL generation endpoints. Designed exclusively for idempotent GET data.

## Known risks
- Data may be briefly stale up to the configured TTL.

## Reusable helper extraction ideas
- This is already a highly reusable helper.

## Safe to edit
- Yes, adding more cache-clearing mechanisms is safe.

## Do not edit
- Do not remove the in-flight deduplication logic (`inFlightRequests.get(key)`); it is critical for preventing strict-mode double-renders from spamming the backend.

## Related flow docs
N/A

## Related contract docs
N/A
