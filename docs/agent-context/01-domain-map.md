# Domain Map

PrintEase is divided into the following domains:

## Backend Domain
Owns: auth, upload, page count, price calculation, orders, manual collection, print queue, signed URLs, agent API
Does not own: actual printer execution, Electron security, local OS printer state

## Desktop Agent Domain
Owns: pairing with backend, printer discovery, job polling, download signed files, hash verification, local printing, desktop updates
Does not own: price calculation, payment verification, manual collection approval, Supabase service key

## Frontend Domain
Owns: user upload UI, order creation UI, hub dashboard, manual collection button, agent approval page, API calls
Does not own: real page count, real print approval, file signing, local printer control

## Database Domain
Owns: schemas, orders table, print_jobs table, print_order_files table

## Storage Domain
Owns: Supabase private buckets, document hashes

## Security Domain
Owns rules like: who can do what, which URLs are allowed, which data must never go to frontend/desktop, which states are forbidden

## Release/Update Domain
Owns: desktop electron-builder config, GitHub releases, auto-update checks
