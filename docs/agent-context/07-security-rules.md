# Security Rules

1. Desktop agent must NEVER receive the Supabase Service Role key.
2. Signed URLs for document downloads must be tightly scoped (10 minutes) and verified before issuing.
3. Hub owners can only collect cash for orders assigned to their `centreId`.
4. Desktop IPC channels must validate `senderFrame.url` matches the allowed packaged or dev frontend origins.
5. All external URLs opened via Electron must be strictly validated.
6. The `isLimitedLoginlessOrder` check must enforce the 5-page guest print limit.
