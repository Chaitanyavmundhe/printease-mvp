-- Add page_views column to platform_visits table
ALTER TABLE platform_visits ADD COLUMN IF NOT EXISTS page_views integer NOT NULL DEFAULT 1;
