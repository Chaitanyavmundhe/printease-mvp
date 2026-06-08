# Schema Health Audits

This directory contains read-only SQL scripts used to audit the health of the database schema and identify any inconsistencies or orphaned data.

## How to Run

1. Open the Supabase Dashboard for your project.
2. Navigate to the **SQL Editor**.
3. Copy the contents of the audit script (e.g., `20260610_schema_health_audit.sql`).
4. Paste it into the SQL Editor and click **Run**.

## Purpose

These audits are designed to check:
- Valid enum values for roles, statuses, payment states.
- Orphaned records (e.g., print jobs pointing to missing orders).
- Null constraints violations (e.g., missing storage paths or expirations).

**IMPORTANT:** Do not add strict constraints (like `CHECK` or `FOREIGN KEY`) to the schema until these audit scripts return zero invalid rows. Adding constraints prematurely will cause migrations to fail and break production.

## Next Steps
Once the database audit is completely clean, you can proceed to Phase 5 by writing standard migrations that enforce these constraints at the schema level.
