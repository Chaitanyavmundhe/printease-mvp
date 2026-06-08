# MANUAL COLLECTION CONTRACT

## Producer
Frontend `collectManualPayment` (Hub dashboard)

## Consumer
Backend `/api/orders/:id/collect-payment` (`orderController.js`)

## Payload shape
```json
{
  "method": "cash",
  "transactionNote": "Paid exact change",
  "autoPrintAfterCollection": true
}
```

## Required fields
- `method`: Exact string matching `'cash'` or `'manual_upi'`.

## Optional fields
- `transactionNote`: String up to 200 chars.
- `autoPrintAfterCollection`: Boolean, defaults to `true` on backend if omitted, but frontend explicitly passes it.

## Legacy compatibility if any
Previously allowed any method and silently converted to `CASH`. Now strictly rejects invalid methods.

## Validation rules
- `method` strictly validated.
- `transactionNote` truncated/trimmed to 200 chars.

## Security rules
- 400 Bad Request on invalid method.

## Failure behavior
- 400 if method is invalid.
- 404 if order not found for hub.
- 400/409 if cancelled or already paid.
