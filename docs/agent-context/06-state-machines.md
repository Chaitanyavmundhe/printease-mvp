# State Machines

PrintEase has several critical state machines.

## Order Payment Status
`pending` -> `verified` -> `collected`
(or `failed` / `refunded`)

## Print Job Status
`queued` -> `assigned` -> `accepted` -> `downloading` -> `printing` -> `completed`
(or `failed` / `cancelled`)

## Agent Pairing Status
`pending` -> `claimed` -> `confirmed`
(or `rejected` / `expired`)
