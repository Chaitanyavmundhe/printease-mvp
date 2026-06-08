# APP EVENTS

## File paths
`frontend/src/utils/appEvents.js`

## Responsibility
Provides a lightweight event emitter (pub-sub) for communicating system-wide occurrences (such as order updates or payments) between unlinked React components without relying on global state contexts or prop-drilling.

## Owns
- The internal Set of listener callbacks.
- `emitOrderChanged` broadcaster.

## Does not own
- State updates, data caching, or backend synchronization.

## Important functions
- `emitOrderChanged(payload)`: Notifies all active subscribers that an order has been updated.
- `onOrderChanged(callback)`: Subscribes a function to the event. Returns an unsubscribe closure for easy `useEffect` cleanup.

## Inputs
- Callbacks and optional payloads (e.g., `{ reason, orderId }`).

## Outputs
- Invokes subscribed functions asynchronously.

## Side effects
- Triggers side-effects in whatever components are listening (such as `HistoryPage.jsx` invalidating its view).

## API/database calls
- None.

## Security rules
- Payloads should not contain highly sensitive plain-text auth data just in case an unintended listener taps into the stream.

## Known risks
- If listeners are not properly cleaned up, memory leaks will occur in the `listeners` Set.

## Reusable helper extraction ideas
- Can be expanded to track specific component focus events or desktop/hub polling intervals.

## Safe to edit
- Yes, adding more events or structured payload rules is safe.

## Do not edit
- Do not change the `try/catch` safety inside the emitter loop, otherwise one faulty subscriber could crash the entire emitter.

## Related flow docs
N/A

## Related contract docs
N/A
