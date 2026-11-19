import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../apps/api/src/server.js';
import { InMemoryRepository } from '../packages/db/src/repositories.js';
import {
  buildPaginationRow,
  buildResultsPageEmbed,
} from '../apps/bot/src/commands.js';
import { RankedInviteResult } from '../packages/core/src/types.js';

describe('Phase 3 — Results Consistency & Inactive Invite Exclusion', () => {
  let app: FastifyInstance;
  let repo: InMemoryRepository;
  const testJobId = 'job-results-consistency-001';

  const createRanked = (
    code: string,
    status: 'valid' | 'invalid' | 'expired_or_revoked',
    score: number
  ): RankedInviteResult => ({
    invite: {
      code,
      canonicalUrl: `https://discord.gg/${code}`,
      status,
      community: {
        id: `guild-${code}`,
        name: code === 'valid-1' ? '=1+1' : `Server ${code}`,
        description: 'Forex day trading signals',
        approximateMemberCount: 1000,
        approximatePresenceCount: 200,
      },
      lastVerifiedAt: new Date().toISOString(),
    },
    sources: [
      {
        rawUrl: `https://discord.gg/${code}`,
        code,
        canonicalUrl: `https://discord.gg/${code}`,
        sourceUrl: `https://reddit.com/r/forex/${code}`,
        sourceDomain: 'reddit.com',
        sourcePlatform: 'reddit',
        sourcePlatformName: 'Reddit',
        provider: 'mock',
        discoveredAt: new Date().toISOString(),
        contextSnippet: 'Forex trading community',
      },
    ],
    score,
    scoreBreakdown: {
      topicRelevance: 30,
      inviteValidity: status === 'valid' ? 20 : -40,
      languageMatch: 15,
      sourceCredibility: 8,
      freshness: 7,
      activitySignal: 5,
      total: score,
      explanations: [],
    },
    detectedTopics: ['forex'],
    detectedLanguage: 'en',
    isVerifiedFact: status === 'valid',
  });

  beforeAll(async () => {
    repo = new InMemoryRepository();

    const results = [
      createRanked('valid-1', 'valid', 85),
      createRanked('valid-2', 'valid', 80),
      createRanked('expired-1', 'expired_or_revoked', 0),
      createRanked('revoked-1', 'expired_or_revoked', 0),
      createRanked('invalid-1', 'invalid', 0),
    ];

    await repo.saveJob({
      id: testJobId,
      params: { topics: ['forex'], languages: ['en'], limit: 10, depth: 1 },
      mode: 'mock',
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      progress: {
        queriesPlanned: 1,
        queriesAttempted: 1,
        queriesSuccessful: 1,
        queriesFailed: 0,
        urlsDiscovered: 5,
        invitesExtracted: 5,
        uniqueInvites: 5,
        invitesChecked: 5,
        validInvites: 2,
        invalidInvites: 3,
        restrictedOrUnverified: 0,
        queriesExecuted: 1,
        invitesVerified: 5,
        validInvitesFound: 2,
        providerErrors: [],
      },
      results,
    });
    await repo.saveResults(testJobId, results);

    app = buildServer(repo, { apiKey: 'test_consistency_key' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });


  it('exports the displayed result set and protects spreadsheet cells', async () => {
    const headers = { 'x-api-key': 'test_consistency_key' };
    const filters = 'status=valid&minScore=85&language=en&platform=reddit';
    const displayed = await app.inject({ url: '/api/results/' + testJobId + '?' + filters, headers });
    const json = await app.inject({ url: '/api/export/' + testJobId + '?' + filters + '&format=json', headers });
    const csv = await app.inject({ url: '/api/export/' + testJobId + '?' + filters + '&format=csv', headers });

    expect(json.statusCode).toBe(200);
    expect(json.json()).toEqual(displayed.json().results);
    expect(csv.statusCode).toBe(200);
    expect(csv.payload.split('\n')).toHaveLength(2);
    expect(csv.payload).toContain(`"'=1+1"`);
    expect(csv.payload).toContain('https://reddit.com/r/forex/valid-1');
    expect(csv.payload).not.toContain('valid-2');
  });

  describe('Fastify API Endpoint Filtering & Excluded Counts', () => {
    it('GET /api/results/:id?status=valid defaults to active valid invites and reports accurate excludedCount', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/results/${testJobId}?status=valid`,
        headers: { 'x-api-key': 'test_consistency_key' },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);

      expect(data.count).toBe(2);
      expect(data.totalCount).toBe(5);
      expect(data.excludedCount).toBe(3);
      expect(data.results.every((r: any) => r.invite.status === 'valid')).toBe(true);
    });

    it('GET /api/results/:id?status=expired_or_revoked retrieves only inactive invites for diagnostics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/results/${testJobId}?status=expired_or_revoked`,
        headers: { 'x-api-key': 'test_consistency_key' },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);

      expect(data.count).toBe(3);
      expect(data.totalCount).toBe(5);
      expect(data.excludedCount).toBe(2);
      expect(data.results.every((r: any) => r.invite.status !== 'valid')).toBe(true);
    });

    it('GET /api/results/:id?status=all returns all stored records without deleting historical data', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/results/${testJobId}?status=all`,
        headers: { 'x-api-key': 'test_consistency_key' },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);

      expect(data.count).toBe(5);
      expect(data.totalCount).toBe(5);
      expect(data.excludedCount).toBe(0);
    });
  });

  describe('Discord Embeds & Status-Preserving Pagination', () => {
    it('buildResultsPageEmbed includes warning notice when inactive invitations were excluded', () => {
      const validResults = [createRanked('valid-1', 'valid', 85)];
      const embed = buildResultsPageEmbed(testJobId, validResults, 1, 1, null, 3);
      const json = embed.toJSON();

      expect(json.description).toContain('3 invalid or expired invitations were excluded from recommendations');
    });

    it('buildPaginationRow preserves custom status filter in button customId', () => {
      const rowValid = buildPaginationRow(testJobId, 1, 3, 'user-123', 'valid');
      const [, , nextBtnValid] = rowValid.components as any[];
      // For 'valid', backwards compatible format is used
      expect(nextBtnValid.data.custom_id).toBe(`page:${testJobId}:2:user-123`);

      const rowInactive = buildPaginationRow(testJobId, 1, 3, 'user-123', 'expired_or_revoked');
      const [, , nextBtnInactive] = rowInactive.components as any[];
      expect(nextBtnInactive.data.custom_id).toBe(`page:${testJobId}:2:user-123:expired_or_revoked`);
    });
  });
  it('hides a guild found in an earlier job even if its invite code changed', async () => {
    const current = (await repo.getJob(testJobId))!;
    const earlier = createRanked('old-invite', 'valid', 80);
    earlier.invite.community!.id = 'guild-valid-1';
    await repo.saveJob({ ...current, id: 'earlier-guild-job', createdAt: '2020-01-01T00:00:00Z', results: [earlier] });
    await repo.saveResults('earlier-guild-job', [earlier]);

    const headers = { 'x-api-key': 'test_consistency_key' };
    const query = '?newOnly=true&status=valid';
    const displayed = await app.inject({ url: '/api/results/' + testJobId + query, headers });
    const exported = await app.inject({ url: '/api/export/' + testJobId + query + '&format=json', headers });

    expect(displayed.statusCode).toBe(200);
    expect(displayed.json().results.map((row: RankedInviteResult) => row.invite.code)).toEqual(['valid-2']);
    expect(exported.json()).toEqual(displayed.json().results);
  });

});
