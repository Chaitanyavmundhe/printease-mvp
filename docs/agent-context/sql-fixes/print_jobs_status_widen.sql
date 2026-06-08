-- ==============================================================================
-- PHASE 11 DB CONSTRAINT FIX: Widen `print_jobs_status_check`
-- ==============================================================================
-- Context: 
-- Phase 6 defined a check constraint for print_jobs.status that only allowed:
-- ('queued', 'accepted', 'downloading', 'printing', 'completed', 'failed', 'cancelled')
-- 
-- However, the backend currently actively sets `status = 'assigned'` when 
-- routing jobs to specific agents prior to them being accepted.
-- 
-- This patch drops the strict constraint and replaces it with a widened one
-- so that existing logic continues to work safely without breaking legacy constraints.

DO $$ 
BEGIN
  -- 1. Drop the narrowly defined constraint from Phase 6
  ALTER TABLE print_jobs 
    DROP CONSTRAINT IF EXISTS print_jobs_status_check;

  -- 2. Add the corrected constraint including 'assigned'
  ALTER TABLE print_jobs 
    ADD CONSTRAINT print_jobs_status_check 
    CHECK (status IN (
      'queued', 
      'assigned', 
      'accepted', 
      'downloading', 
      'printing', 
      'completed', 
      'failed', 
      'cancelled'
    ));

  RAISE NOTICE 'print_jobs_status_check updated to include assigned status';
END $$;
