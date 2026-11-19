ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS target_platforms JSONB;
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS min_members INTEGER;
ALTER TABLE search_job_results ADD COLUMN IF NOT EXISTS source_snapshot JSONB;
