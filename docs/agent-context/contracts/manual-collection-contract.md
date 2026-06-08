# Contract: manual-collection-contract

## Purpose
Defines the request and response shape for hub-side offline payment collection.

## Request Shape
```json
{
  "method": "cash",
  "transactionNote": "optional note, max 200 characters",
  "autoPrintAfterCollection": true
}
```

Allowed `method` values:

- `cash`
- `manual_upi`

## Response Shape
```json
{
  "success": true,
  "message": "Payment collected.",
  "payment": {
    "id": "payment id",
    "orderId": "order id",
    "method": "CASH",
    "status": "collected"
  },
  "order": {
    "id": "order id",
    "paymentStatus": "collected",
    "status": "Payment Collected"
  },
  "autoQueue": {
    "queued": true,
    "message": "Payment collected. Print job queued."
  },
  "printJob": {
    "id": "print job id"
  }
}
```

## Used by
- `manual-collection-flow.md`
- `backend/src/controllers/orderController.js`
- `backend/src/services/manualCollectionService.js`

## Security considerations
- Reject any method other than `cash` or `manual_upi`.
- Hub must own the order.
- Cancelled unpaid orders must not be collected.
- Auto-print must still pass print readiness checks.
