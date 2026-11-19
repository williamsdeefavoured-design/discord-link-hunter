-- ==============================================================================
-- Migration: 0003_add_country_evidence.sql
-- Project: Discord Link Hunter v3
-- Mode: Strictly Additive (Non-destructive)
-- Target: Supabase PostgreSQL (public schema)
-- Description: Add country and country evidence fields to communities,
--              search_jobs, and search_job_results tables.
-- ==============================================================================

-- Communities table: Add country evidence fields
ALTER TABLE communities ADD COLUMN IF NOT EXISTS country_code VARCHAR(8);
ALTER TABLE communities ADD COLUMN IF NOT EXISTS country_name TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS country_evidence_status VARCHAR(32) DEFAULT 'unknown';
ALTER TABLE communities ADD COLUMN IF NOT EXISTS country_source_url TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS country_supporting_evidence TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS country_verified_at TIMESTAMPTZ;

-- Search Jobs table: Add country parameter and filter notice
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS country VARCHAR(8);
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS country_filter_notice TEXT;

-- Search Job Results table: Add snapshot of country evidence
ALTER TABLE search_job_results ADD COLUMN IF NOT EXISTS country_code VARCHAR(8);
ALTER TABLE search_job_results ADD COLUMN IF NOT EXISTS country_name TEXT;
ALTER TABLE search_job_results ADD COLUMN IF NOT EXISTS country_evidence_status VARCHAR(32) DEFAULT 'unknown';
ALTER TABLE search_job_results ADD COLUMN IF NOT EXISTS country_source_url TEXT;
ALTER TABLE search_job_results ADD COLUMN IF NOT EXISTS country_supporting_evidence TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_communities_country_code ON communities(country_code);
CREATE INDEX IF NOT EXISTS idx_search_jobs_country ON search_jobs(country);
CREATE INDEX IF NOT EXISTS idx_search_job_results_country_code ON search_job_results(country_code);
