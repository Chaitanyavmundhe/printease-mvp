# Contract: order-contract

## Purpose
Defines the backend order shape used by payment, hub dashboard, history, and print queue flows.

## Shape
```json
{
  "id": "order id",
  "orderCode": "public order code",
  "userId": "user id or null",
  "centreId": "hub id",
  "documentName": "name or summary",
  "pages": 2,
  "copies": 1,
  "selectedPageCount": 2,
  "printablePageCount": 2,
  "sheetCount": 2,
  "amount": 10,
  "totalAmountPaise": 1000,
  "paymentStatus": "pending",
  "status": "Payment Pending",
  "customerType": "registered",
  "guestToken": "server-only/token response only",
  "priceSnapshot": {},
  "printConfigSnapshot": {}
}
```

## Used by
- draft order flow
- manual collection flow
- payment flow
- print queue flow
- history flow

## Security considerations
- Do not expose `guestToken` except as one-time/loginless access token response.
- Do not print unless payment is collected/verified.
- History should use snapshots, not current hub pricing.
