# Database Architecture & Supabase Guide

This document describes the relational schema, Drizzle ORM configuration, migration procedures, and connection pooling for Supabase PostgreSQL.

## Entity Relationship Overview

```text
+----------------+          +-----------------------+
|  communities   | 1      * |        invites        |
|----------------|----------|-----------------------|
| id (PK)        |          | code (PK)             |
| name           |          | canonical_url         |
| description    |          | status                |
| member_count   |          | status_reason         |
| presence_count |          | community_id (FK)     |
| detected_lang  |          | last_checked_at       |
+----------------+          +-----------------------+
                                        | 1
                                        |
                                        | *
                            +-----------------------+
                            |     invite_sources    |
                            |-----------------------|
                            | invite_code (PK, FK)  |
                            | source_id (PK, FK)    |
                            | context_snippet       |
                            +-----------------------+
                                        | *
                                        |
                                        | 1
+----------------+          +-----------------------+
|  search_jobs   | 1      * |        sources        |
|----------------|----------|-----------------------|
| id (PK)        |          | id (PK)               |
| status         |          | url                   |
| topics (jsonb) |          | domain                |
| progress       |          | source_type           |
+----------------+          +-----------------------+
        | 1
        |
        | *
+-------------------------+
|   search_job_results    |
|-------------------------|
| id (PK)                 |
| job_id (FK)             |
| invite_code (FK)        |
| score                   |
| score_breakdown (jsonb) |
+-------------------------+
```

## Schema Definitions

1. **`communities`**: Verified Discord guilds discovered via valid invites.
2. **`invites`**: Normalized Discord invite codes with verification status and timestamps.
3. **`sources`**: URLs and domains where invitations were discovered (Serper search hits, directory pages).
4. **`invite_sources`**: Many-to-many relationship tracking where each invite was referenced.
5. **`search_jobs`**: Job tracking state machine (`queued`, `running`, `partial`, `completed`, `failed`, `cancelled`).
6. **`search_job_results`**: Ranked results linked to specific search jobs with detailed score breakdowns.
7. **`provider_usage`**: Audit log of API requests made to Serper, Tavily, and Mock providers.

## Supabase Connection Modes

Supabase offers two connection strings:
- **Direct Connection (`DIRECT_URL`)**: Port 5432, connects directly to Postgres. Best for migrations and DDL.
- **Transaction Pooler (`DATABASE_URL`)**: Port 6543, uses Supavisor / PgBouncer. Essential on serverless runtimes. Note: Prepared statements must be disabled (`prepare: false` in postgres.js) when using transaction pooler mode.

## Running Migrations

To run schema migrations idempotently against Supabase:

```bash
npm run db:migrate --workspace=@discord-link-hunter/db
```

Or via direct tsx:
```bash
npx tsx packages/db/src/migrate.ts
```

## Offline Mock Fallback

When `DATABASE_URL` is not set or Supabase is temporarily unreachable, the system automatically switches to the `InMemoryRepository`. This repository includes synthetic seed demo data (`job-seed-demo-01`), allowing complete development and testing without a database connection.

