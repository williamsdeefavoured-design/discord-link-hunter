# Discord Link Hunter v3 delivery and rollout

## Scope and behavior

This release adds an opt-in country filter, independent language/topic selections, and original-source platform constraints to the existing Live discovery workflow. **All Countries** disables geographic filtering. African ISO entries are excluded from the selector and from specific-country submissions. An unrestricted search can include African and unknown locations if they meet the other criteria.

A Discord guild description can supply an explicit, unambiguous self-declaration. The result records the matched statement, public invite URL, observation timestamp, and `self_declared` status. Existing structured `verified` evidence is supported. Independently verified classification requires an authenticated public source explicitly linking the guild to a country. Automated discovery currently has no such source integration. A regional domain, poster location, guild name, query language, or incidental country mention does not establish a country. Unknown and different countries fail a specific-country filter. A self-declaration qualifies and remains labeled as such. Historical result snapshots with missing evidence remain unknown. Historical records can lack an evidence timestamp.

Platform selection uses indexed public search and filters each evidence URL against the selected origins before accepting invites or leads. Discord public discovery is limited to the directory path. The source registry covers platform-owned domains and configured forum/blog domains. Custom domains and provider indexing gaps limit coverage. New PostgreSQL results keep a job-specific snapshot of sources; historical records can only display the shared provenance previously stored. The result limit remains a cap, and matching filters are never relaxed to fill it.

The UI supports multiple supported languages and topics. Italian, Turkish, and Dutch use localized query terms and heuristic detection. The detector currently produces a single primary language and may use third-party snippet evidence. A separate multilingual classifier and auditable language evidence fields are pending.

The minimum-members threshold now excludes missing and below-threshold counts when set. Membership range controls, evidence-based access tiers, historical exclusion lists, and New Servers Only are pending. Existing in-job guild deduplication remains in place.

The existing bounded Live search, CSV/JSON endpoints, login, API proxy, favicon and bot commands remain available. CSV and JSON follow the Results view filters. XLSX/PDF exports, saved search templates, scheduled monitoring, and notifications are pending. Deep mode has not been separately qualified for release. Extended Research requires a durable scheduler, claim leases, persisted checkpoints, pause/resume/cancel semantics, and shared provider quotas. The current in-process worker does not provide those guarantees. Keep both modes out of public controls until validated.

Provider request limits and API authentication are already present. The bot allowlist only restricts access when configured. Keep registration guild-scoped with a nonempty `ALLOWED_DISCORD_USER_IDS`. Per-user/per-guild quotas, distributed claims and global concurrency guarantees require follow-up before broadening access. Invite validity describes Discord's invitation response and gives no assurance about a community's trading claims.

## Local verification

From the repository root, with the lockfile dependencies:

```powershell
npm ci
npm run typecheck
npm run typecheck --workspaces --if-present
npm test
npm run build --workspace=@discord-link-hunter/web
```

Vitest ignores the application database URLs and skips loading the application's credential file. Its in-memory repository neither reads nor writes the file-backed job store. The PostgreSQL integration case is opt-in with `DLH_TEST_DATABASE_URL`, accepts only a loopback URL for a dedicated database named `discord_link_hunter_test`, and creates and removes a uniquely named schema. It exercises a pre-country row, migration replay, repository reads and writes, job-specific provenance, and deletion with a shared invite.

To run the database case with a running local Docker engine:

```powershell
$dlhFixturePassword = [guid]::NewGuid().ToString('N')
$dlhFixtureContainer = 'dlh-postgres-' + [guid]::NewGuid().ToString('N')
docker run --detach --rm --name $dlhFixtureContainer -p 127.0.0.1:55432:5432 -e "POSTGRES_PASSWORD=$dlhFixturePassword" -e POSTGRES_DB=discord_link_hunter_test postgres:16
if ($LASTEXITCODE -ne 0) { throw 'Could not start the local PostgreSQL container.' }
try {
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        docker exec $dlhFixtureContainer pg_isready -h 127.0.0.1 -U postgres -d discord_link_hunter_test
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 1
    }
    if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL did not become ready.' }
    $env:DLH_TEST_DATABASE_URL = "postgres://postgres:${dlhFixturePassword}@127.0.0.1:55432/discord_link_hunter_test"
    npm test -- tests/schema-repair-and-persistence.test.ts
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL integration fixture failed.' }
} finally {
    Remove-Item Env:DLH_TEST_DATABASE_URL -ErrorAction SilentlyContinue
    docker stop $dlhFixtureContainer
}
```

## Supabase migration and Railway rollout

1. Rehearse the migration against an isolated staging database with representative pre-country data and the real schema. Check the repository fixture and record pre-upgrade counts for jobs, results, invites, sources, and communities.
2. After rollout approval, capture a restorable Supabase backup and record the previous Railway release IDs. Verify the destination and database role from the Supabase project and use its secret-managed migration connection in a dedicated shell. Assign that connection to `DATABASE_URL` for the migration process, since it takes precedence over `DIRECT_URL`. Keep the secret out of commands and logs.
3. Run the checked-in one-off migrator from the release checkout.

   ```powershell
   npm run db:migrate --workspace=@discord-link-hunter/db
   if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Keep the previous service builds.' }
   ```

   The runner creates baseline objects where missing and explicitly applies `0003_add_country_evidence.sql`, `0004_add_result_country_timestamp.sql`, and `0005_persist_discovery_filters.sql` inside a transaction with an advisory lock. The additions preserve rows and foreign keys. Inspect `information_schema.columns` for `search_jobs.country`, `country_filter_notice`, `target_platforms`, and `min_members`; `search_job_results.country_verified_at` and `source_snapshot`; and the country evidence fields on `communities` and `search_job_results`. Compare the historical counts and open a pre-country job through staging or an authorized read-only check.

   ```sql
   SELECT table_name, column_name, data_type
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND ((table_name = 'search_jobs' AND column_name IN
           ('country', 'country_filter_notice', 'target_platforms', 'min_members'))
       OR (table_name IN ('communities', 'search_job_results') AND column_name IN
           ('country_code', 'country_name', 'country_evidence_status',
            'country_source_url', 'country_supporting_evidence', 'country_verified_at'))
       OR (table_name = 'search_job_results' AND column_name = 'source_snapshot'))
   ORDER BY table_name, column_name;
   ```

4. Deploy the matching release to Railway API, then Bot, then Web from the monorepo root. Install with `npm ci`. Use each service's existing `npm run start --workspace=@discord-link-hunter/{api,bot,web}` command with the literal service name, and build Web with `npm run build --workspace=@discord-link-hunter/web`. Preserve the server-side API secret and existing private login settings. Start with the existing replica counts and avoid overlapping worker expansion.
5. Smoke-test the private login and dashboard, an existing job, one small approved Live search, results and provenance, CSV/JSON, and the Discord commands. Verify deletion with a disposable job only. If a service regresses, roll back to its previous Railway release. Leave the additive schema in place so previously saved evidence survives. Recover data from the backup only if a separately diagnosed data issue requires it.

The existing Discord registration code targets a single guild. Deploy the Bot with its existing token and client ID. With the intended `DISCORD_GUILD_ID` and allowlist configured, run `npm run register --workspace=@discord-link-hunter/bot` if that guild needs the updated command definitions. Guild registration replaces the application's command definitions for that guild. Validate `/ping`, the country option on `/hunt`, `/status`, `/results` pagination, `/verify`, `/export`, and `/dashboard` in the intended guild. Keep global registration deferred.

This release adds no production environment variables. `DLH_TEST_DATABASE_URL` is opt-in and test-only.

## Files changed from the supplied ZIP

- API and Bot: `apps/api/src/server.ts`, `apps/bot/src/commands.ts`
- Web: `apps/web/next.config.mjs`, `apps/web/src/app/discover/page.tsx`, `apps/web/src/app/results/page.tsx`
- Config and core: `packages/config/src/index.ts`, `packages/core/src/countries.ts`, `packages/core/src/languages.ts`, `packages/core/src/ranking.ts`, `packages/core/src/sources.ts`, `packages/core/src/types.ts`
- Database: `packages/db/src/client.ts`, `packages/db/src/migrate.ts`, `packages/db/src/repositories.ts`, `packages/db/src/schema.ts`
- Research: `packages/research/src/orchestrator.ts`, `packages/research/src/query-planner.ts`
- Updated regression tests: `tests/research-sources.test.ts`, `tests/results-consistency.test.ts`, `tests/schema-repair-and-persistence.test.ts`
- New tests: `tests/discovery-country-and-platform.test.ts`
- New migrations: `packages/db/migrations/0004_add_result_country_timestamp.sql`, `packages/db/migrations/0005_persist_discovery_filters.sql`
- New runbook: `docs/V3_DELIVERY.md`

## Verification recorded for this delivery

- Root typecheck and all seven workspace typechecks passed. The final workspace check ran after the web build finished generating its types.
- The full suite passed all 117 tests in 20 files using a temporary, loopback-only PostgreSQL 18.6 instance. The database case exercised migration replay and shared-invite deletion. The temporary server shut down successfully.
- The Next.js production build passed and generated 11 static pages, including the existing favicon route. The repository has no separate lint command; the build completed its lint/type validation step.
- A deployed login or Live provider smoke test, staging migration rehearsal, Railway rollout, and Discord registration require the corresponding authorized environments. None were run for this delivery.
