import postgres from 'postgres';
import { getConfig } from '@discord-link-hunter/config';
import { resolveConnectionString } from './client.js';

export async function runMigrations() {
  const config = getConfig();
  const rawString = config.DATABASE_URL || config.DIRECT_URL;

  if (!rawString) {
    console.log('[Migrate] No DATABASE_URL or DIRECT_URL set. Skipping migrations.');
    return { success: false, reason: 'No connection string' };
  }

  const connectionString = resolveConnectionString(rawString) || rawString;

  console.log('[Migrate] Connecting to Supabase Postgres...');
  const sql = postgres(connectionString, { max: 1, connect_timeout: 15 });

  try {
    await sql`
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
    `;

    await sql`
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
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        domain TEXT,
        source_type VARCHAR(32) NOT NULL,
        discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS invite_sources (
        invite_code VARCHAR(64) NOT NULL REFERENCES invites(code) ON DELETE CASCADE,
        source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        context_snippet TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (invite_code, source_id)
      );
    `;

    await sql`
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
    `;

    await sql`
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
    `;

    await sql`
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
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS provider_usage (
        id TEXT PRIMARY KEY,
        provider VARCHAR(32) NOT NULL,
        endpoint TEXT,
        request_count INTEGER NOT NULL,
        estimated_cost_credits INTEGER DEFAULT 0,
        error_category TEXT,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    // Ensure additive columns exist on pre-existing tables
    await sql`ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;`;
    await sql`ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS planned_queries JSONB;`;
    await sql`ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS estimated_requests INTEGER DEFAULT 0;`;
    await sql`ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS estimated_credits INTEGER DEFAULT 0;`;
    await sql`ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS dry_run_explanation TEXT;`;
    await sql`ALTER TABLE search_job_results ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;`;

    // Indexes for fast querying
    await sql`CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_invites_community_id ON invites(community_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_search_jobs_status ON search_jobs(status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_search_jobs_created_at ON search_jobs(created_at DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_search_job_results_job_id ON search_job_results(job_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_search_job_results_score ON search_job_results(score DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_verification_history_invite_code ON verification_history(invite_code);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_provider_usage_provider ON provider_usage(provider);`;

    console.log('[Migrate] Successfully applied all migrations to Supabase Postgres!');
    await sql.end();
    return { success: true };
  } catch (err: any) {
    console.error('[Migrate] Error running migrations:', err.message);
    await sql.end();
    return { success: false, reason: err.message };
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations().then((res) => {
    if (!res.success) {
      console.log('Migration completed with warning/notice:', res.reason);
    }
  });
}

