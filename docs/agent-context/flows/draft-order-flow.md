# Draft Order Flow

## Purpose
Create a priced draft/pending order from uploaded documents and print settings before payment is collected.

## Actors
- User or loginless visitor
- Backend
- Hub

## Entry points
- `POST /api/orders`
- upload page Continue to Payment

## Input
- centre code/hub ID
- document IDs/files
- selected pages, copies, color, side, orientation, DPI, watermark, paper settings

## Output
- `print_orders` row
- `print_order_files` rows
- price snapshot and print config snapshot
- guest access token for loginless order

## Source of truth
- `print_orders`
- `print_order_files`
- `documents`

## State changes
- creates order metadata
- creates per-file metadata
- stores snapshots for future history

## Micro-components used
- price calculation
- print options normalization
- guest token creation
- page-count validation

## Files involved
- `backend/src/controllers/orderController.js`
- `backend/src/db/repository.js`
- `backend/src/utils/calculatePrice.js`
- `backend/src/utils/printOptions.js`

## Security rules
- backend must use trusted PDF page counts
- loginless orders require guest token for access
- do not print until payment is ready
- store snapshots; do not recalculate old history from current pricing

## Known risks
- trusting frontend page count
- mixing old unpaid order into new order
- missing per-file snapshots

## Tiny tasks
- extract order payload validator
- add tests for multi-file price snapshot

## Tests
- single-file order creates one order file
- multi-file order creates all order files
- loginless order gets guest token
