-- ==============================================================================
-- Migration: 0001_initial_schema.sql
-- Project: Discord Link Hunter v2.1
-- Mode: Strictly Additive (Non-destructive)
-- Target: Supabase PostgreSQL (public schema)
-- ==============================================================================

-- 1. Communities Table (Discord Guilds / Servers)
CREATE TABLE IF NOT EXISTS communities (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  detected_language VARCHAR(8),
  topics JSONB,
  member_count INTEGER,
  presence_count INTEGER,
  icon TEXT,
  banner TEXT,
  splash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Invites Table (Unique Discord Invitation Codes)
CREATE TABLE IF NOT EXISTS invites (
  code VARCHAR(64) PRIMARY KEY,
  canonical_url TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  status_reason TEXT,
  community_id VARCHAR(64) REFERENCES communities(id) ON DELETE SET NULL,
  channel_id VARCHAR(64),
  channel_name TEXT,
  inviter_username TEXT,
  expires_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Sources Table (Discovered Origin URLs)
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  domain TEXT,
  source_type VARCHAR(32) NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Invite Sources Table (Attribution Junction)
CREATE TABLE IF NOT EXISTS invite_sources (
  invite_code VARCHAR(64) NOT NULL REFERENCES invites(code) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  context_snippet TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (invite_code, source_id)
);

-- 5. Search Jobs Table (Discovery Runs & Dry Run Plans)
CREATE TABLE IF NOT EXISTS search_jobs (
  id VARCHAR(64) PRIMARY KEY,
  owner_id TEXT,
  topics JSONB NOT NULL,
  languages JSONB NOT NULL,
  search_limit INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  mode VARCHAR(16) NOT NULL,
  status VARCHAR(24) NOT NULL,
  progress JSONB NOT NULL,
  error_details TEXT,
  is_simulated BOOLEAN DEFAULT FALSE,
  planned_queries JSONB,
  estimated_requests INTEGER DEFAULT 0,
  estimated_credits INTEGER DEFAULT 0,
  dry_run_explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 6. Search Job Results Table (Ranked Results per Job)
CREATE TABLE IF NOT EXISTS search_job_results (
  id TEXT PRIMARY KEY,
  job_id VARCHAR(64) NOT NULL REFERENCES search_jobs(id) ON DELETE CASCADE,
  invite_code VARCHAR(64) NOT NULL REFERENCES invites(code) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  score_breakdown JSONB NOT NULL,
  detected_topics JSONB,
  detected_language VARCHAR(8),
  is_simulated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Verification History (Audit Log of Discord Verification Checks)
CREATE TABLE IF NOT EXISTS verification_history (
  id VARCHAR(64) PRIMARY KEY,
  invite_code VARCHAR(64) NOT NULL REFERENCES invites(code) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL,
  status_reason TEXT,
  http_status INTEGER,
  member_count INTEGER,
  presence_count INTEGER,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Provider Usage (Daily API Request & Credit Tracking)
CREATE TABLE IF NOT EXISTS provider_usage (
  id TEXT PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  endpoint TEXT,
  request_count INTEGER NOT NULL,
  estimated_cost_credits INTEGER DEFAULT 0,
  error_category TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive Column Guarantees for Safe Upgrades
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS planned_queries JSONB;
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS estimated_requests INTEGER DEFAULT 0;
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS estimated_credits INTEGER DEFAULT 0;
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS dry_run_explanation TEXT;
ALTER TABLE search_job_results ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);
CREATE INDEX IF NOT EXISTS idx_invites_community_id ON invites(community_id);
CREATE INDEX IF NOT EXISTS idx_search_jobs_status ON search_jobs(status);
CREATE INDEX IF NOT EXISTS idx_search_jobs_created_at ON search_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_job_results_job_id ON search_job_results(job_id);
CREATE INDEX IF NOT EXISTS idx_search_job_results_score ON search_job_results(score DESC);
CREATE INDEX IF NOT EXISTS idx_verification_history_invite_code ON verification_history(invite_code);
CREATE INDEX IF NOT EXISTS idx_provider_usage_provider ON provider_usage(provider);





-- =====================================================
-- DISCORD LINK HUNTER — DATABASE SECURITY
-- Row Level Security and API access restrictions
-- =====================================================

-- Enable Row Level Security for all 8 tables

ALTER TABLE public.communities
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.invites
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sources
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.invite_sources
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.search_jobs
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.search_job_results
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.verification_history
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.provider_usage
ENABLE ROW LEVEL SECURITY;

-- Prevent public and browser-facing roles
-- from directly accessing internal research data.

REVOKE ALL PRIVILEGES ON TABLE
  public.communities,
  public.invites,
  public.sources,
  public.invite_sources,
  public.search_jobs,
  public.search_job_results,
  public.verification_history,
  public.provider_usage
FROM PUBLIC, anon, authenticated;
