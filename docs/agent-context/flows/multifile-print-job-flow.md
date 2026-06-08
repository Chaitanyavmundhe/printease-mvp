# Multi-file Print Job Flow

## Context
As the PrintHub system scales from single-document orders to multi-document shopping carts, the desktop agent must elegantly download, prepare, and print an ordered list of files.

## The Future Flow (Once Desktop is Fully Updated)

1. **Order Creation:** A user adds multiple files to an order. `print_orders` and `print_order_files` are populated.
2. **Payment Success:** The order is confirmed. A single `print_jobs` record is created to represent the batch execution.
3. **Job Preparation:** The backend inserts corresponding `print_job_files` records for each document inside the batch, mapped via `print_order_files`.
4. **Agent Polling:** The desktop agent requests the next job. The backend responds with:
   ```json
   {
     "id": "job_123",
     "orderCode": "ABCD",
     "status": "queued",
     "files": [
       {
         "id": "file_1",
         "url": "https://...",
         "sequence": 1,
         "options": { "colorMode": "bw", "copies": 1 }
       },
       {
         "id": "file_2",
         "url": "https://...",
         "sequence": 2,
         "options": { "colorMode": "color", "copies": 2 }
       }
     ]
   }
   ```
5. **Sequential Printing:**
   - The agent downloads `file_1` and prints it. It sends an API request to update the status of `file_1` to `completed` in `print_job_files`.
   - The agent downloads `file_2` and prints it. It updates the status of `file_2`.
6. **Job Completion:** Once all `print_job_files` are marked `completed`, the overarching `print_jobs` status transitions to `completed`.

## Current State (Phase 7)
- We have created the `print_job_files` table to *prepare* the database schema.
- We have **not** changed the backend API or desktop agent to enforce this yet.
- `print_jobs` remains an order-level job, relying on `print_order_files` to populate the `files[]` array.
