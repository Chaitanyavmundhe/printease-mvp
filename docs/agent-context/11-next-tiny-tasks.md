# Next Tiny Tasks

Task:
Add validateManualCollectionMethod only.

Allowed files:
backend/src/controllers/orderController.js
future backend/src/services/manualCollectionService.js if extracting
related docs

Do not touch:
Razorpay
desktop
upload
document download

Test:
invalid method returns 400
cash works
manual_upi works
duplicate collection remains idempotent
