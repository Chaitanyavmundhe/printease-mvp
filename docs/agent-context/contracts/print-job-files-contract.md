# Multi-file Print Job Contract

## Current Architecture (Legacy Compatibility)
Currently, a Print Job is strictly treated as an "order-level job". 
- `print_orders` stores a singular `document_url`, `pages`, and `copies`.
- `print_jobs` stores a duplicate `file_url`, `file_sha256`, and `copies`.
- When an agent requests jobs, the backend dynamically builds a `files[]` array in the JSON payload based on the relational `print_order_files` table.

**Important**: We do **not** drop the legacy fields (`document_url`, `file_url`, etc.) from the schema. They must remain as fallbacks so that older agents and APIs don't instantly break.

## Future Architecture (Multi-File Tracking)
The new `print_job_files` table prepares the ground for tracking the execution state of *each file* inside a multi-file print job.

In the future:
1. `print_jobs` will represent the container/batch.
2. `print_job_files` will represent the specific document payload being printed by the desktop agent.
3. As the desktop agent prints a multi-file batch, it can emit events for individual files (e.g., File 1 printed successfully, File 2 failed).

### Desktop Agent Contract
The desktop agent MUST process the `files[]` array inside the print job payload from the backend.
- It should iterate over `files[]` and handle them sequentially.
- If `files[]` is present, it should be the primary source of truth.
- If `files[]` is missing or empty, it should fall back to `job.fileUrl`.

Until the desktop properly processes `files[]` seamlessly, the backend will continue creating single-file payload structures or relying on `job.fileUrl` for the primary document.
