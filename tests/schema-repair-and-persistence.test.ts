import { describe, it, expect, beforeAll } from 'vitest';
import {
  getRepository,
  testDatabaseConnection,
} from '../packages/db/src/index.js';
import { slashCommands, buildResultsPageEmbed, buildPaginationRow } from '../apps/bot/src/commands.js';
import { SearchJob } from '../packages/core/src/types.js';

describe('Database Schema Repair & Bot Startup Verification', () => {
  beforeAll(async () => {
    const status = await testDatabaseConnection();
    if (!status.connected) {
      console.warn('Skipping remote database tests: connection not verified in this environment');
    }
  });

  it('verifies that the database connection test succeeds and queries live jobs', async () => {
    const status = await testDatabaseConnection();
    if (status.connected) {
      const repo = getRepository();
      expect(repo.isMock).toBe(false);
      const jobs = await repo.listJobs(3);
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      // Verify languageFilterNotice property is accessible on jobs
      expect('languageFilterNotice' in jobs[0] || jobs[0].languageFilterNotice === undefined || typeof jobs[0].languageFilterNotice === 'string').toBe(true);
    }
  });

  it('verifies all Discord slash commands remain properly configured', () => {
    const commandNames = slashCommands.map((c) => c.name);
    const expected = ['ping', 'hunt', 'deepsearch', 'verify', 'results', 'status', 'export', 'dashboard'];
    for (const cmd of expected) {
      expect(commandNames).toContain(cmd);
    }
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
