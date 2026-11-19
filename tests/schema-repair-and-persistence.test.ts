import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import * as client from '../packages/db/src/client.js';
import {
  applyMigrations,
  PostgresRepository,
  testDatabaseConnection,
} from '../packages/db/src/index.js';
import { slashCommands, buildResultsPageEmbed, buildPaginationRow } from '../apps/bot/src/commands.js';
import { rankInviteResults, type SearchJob } from '../packages/core/src/index.js';

describe('Database Schema Repair & Bot Startup Verification', () => {
  it('keeps deployment database configuration out of Vitest', async () => {
    expect(client.getDbClient()).toBeNull();
    await expect(testDatabaseConnection()).resolves.toMatchObject({ connected: false });
  });

  it.skipIf(!process.env.DLH_TEST_DATABASE_URL)(
    'migrates pre-country rows twice and reads them through the PostgreSQL repository',
    async () => {
      const url = new URL(process.env.DLH_TEST_DATABASE_URL!);
      if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
          !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
          url.pathname !== '/discord_link_hunter_test' ||
          url.search || url.hash) {
        throw new Error('Use a dedicated loopback PostgreSQL database named discord_link_hunter_test.');
      }
      const name = 'dlh_' + randomUUID().replaceAll('-', '');
      const sql = postgres(url.href, { max: 1, idle_timeout: 0, connect_timeout: 5, onnotice: () => {} });
      try {
        await sql`CREATE SCHEMA ${sql(name)}`;
        await sql`SET search_path TO ${sql(name)}`;
        await sql`CREATE TABLE search_jobs (
          id VARCHAR(64) PRIMARY KEY, owner_id TEXT, topics JSONB NOT NULL,
          languages JSONB NOT NULL, search_limit INTEGER NOT NULL, depth INTEGER NOT NULL,
          mode VARCHAR(16) NOT NULL, status VARCHAR(24) NOT NULL, progress JSONB NOT NULL,
          error_details TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ
        )`;
        await sql`INSERT INTO search_jobs (id, topics, languages, search_limit, depth, mode, status, progress)
          VALUES ('legacy', '["stocks"]', '["fr"]', 3, 1, 'live', 'completed', '{}')`;

        await applyMigrations(sql);
        await applyMigrations(sql);
        const db = client.createDatabase(sql);
        const getDb = vi.spyOn(client, 'getDbClient').mockReturnValue(db);
        try {
          const repo = new PostgresRepository();
          const [legacy] = await repo.listJobs(3);
          expect(legacy.id).toBe('legacy');
          expect(legacy.params.country).toBeUndefined();
          expect(legacy.languageFilterNotice).toBeUndefined();
          await repo.saveJob({ ...legacy, id: 'current', params: { ...legacy.params, country: 'FR', minMembers: 100, targetPlatforms: ['reddit'] } });
          expect((await repo.getJob('current'))?.params).toMatchObject({ country: 'FR', minMembers: 100, targetPlatforms: ['reddit'] });
          const originalSource = 'https://reddit.com/r/markets/comments/fixture';
          const original = rankInviteResults([{
            invite: {
              code: 'persisted', canonicalUrl: 'https://discord.gg/persisted', status: 'valid',
              lastVerifiedAt: '2026-01-02T00:00:00Z',
              community: { id: 'guild-fixture', name: 'Markets', description: 'We are based in France.' },
            },
            sources: [{
              code: 'persisted', rawUrl: 'https://discord.gg/persisted', canonicalUrl: 'https://discord.gg/persisted',
              sourceUrl: originalSource, provider: 'serper', discoveredAt: '2026-01-02T00:00:00Z',
            }],
          }], [], [], { country: 'FR' });
          expect(original).toHaveLength(1);
          await repo.saveResults('current', original);
          await repo.saveJob({ ...legacy, id: 'other' });
          await repo.saveResults('other', [{
            ...original[0],
            sources: [{ ...original[0].sources[0], sourceUrl: 'https://x.com/fixture/status/2' }],
          }]);
          const [stored] = await repo.getJobResults('current');
          expect(stored.countryEvidence).toEqual(original[0].countryEvidence);
          expect(stored.sources.map(({ sourceUrl }) => sourceUrl)).toEqual([originalSource]);
          await expect(repo.deleteJob('current')).resolves.toBe(true);
          expect(await repo.getJobResults('other')).toHaveLength(1);
          expect((await repo.getJob('legacy'))?.params.languages).toEqual(['fr']);
        } finally {
          getDb.mockRestore();
        }
      } finally {
        try {
          await sql`DROP SCHEMA IF EXISTS ${sql(name)} CASCADE`;
        } finally {
          await sql.end({ timeout: 1 });
        }
      }
    },
    30_000,
  );

  it('verifies enabled Discord slash commands remain properly configured', () => {
    const commandNames = slashCommands.map((c) => c.name);
    const expected = ['ping', 'hunt', 'verify', 'results', 'status', 'export', 'dashboard'];
    for (const cmd of expected) {
      expect(commandNames).toContain(cmd);
    }
    expect(commandNames).not.toContain('deepsearch');
  });

  it('renders languageFilterNotice in bot results embed when present', () => {
    const dummyJob: SearchJob = {
      id: 'test-schema-job',
      params: {
        topics: ['stocks'],
        languages: ['es'],
        limit: 5,
        depth: 1,
      },
      mode: 'live',
      status: 'completed',
      progress: {
        queriesPlanned: 2,
        queriesAttempted: 2,
        queriesSuccessful: 2,
        queriesFailed: 0,
        urlsDiscovered: 5,
        invitesExtracted: 3,
        uniqueInvites: 3,
        invitesChecked: 3,
        validInvites: 2,
        invalidInvites: 1,
        restrictedOrUnverified: 0,
        queriesExecuted: 2,
        invitesVerified: 3,
        validInvitesFound: 2,
        providerErrors: [],
      },
      results: [],
      createdAt: new Date().toISOString(),
      languageFilterNotice: 'Strict language filter active [ES]: Found 0 matching communities. 2 communities excluded.',
    };

    const embed = buildResultsPageEmbed('test-schema-job', [], 1, 1, dummyJob);
    const description = (embed.data as any).description;
    expect(description).toContain('Strict language filter active [ES]');
  });

  it('generates pagination row for multi-page search results', () => {
    const row = buildPaginationRow('job-123', 1, 3, 'user-456');
    expect(row.components.length).toBe(3);
    const prevButton: any = row.components[0];
    const indicatorButton: any = row.components[1];
    const nextButton: any = row.components[2];

    expect(prevButton.data.disabled).toBe(true);
    expect(indicatorButton.data.label).toBe('Page 1 of 3');
    expect(nextButton.data.disabled).toBe(false);
  });
});
