import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_RESEARCH_SOURCES,
  extractDiscordInvites,
  identifySourcePlatform,
  RankedInviteResult,
  SourceRegistry,
  verifyMockInvite,
} from '@discord-link-hunter/core';
import {
  MockSearchAdapter,
  QueryPlanner,
  SearchOrchestrator,
} from '@discord-link-hunter/research';
import { InMemoryRepository } from '@discord-link-hunter/db';
import { buildServer } from '../apps/api/src/server.js';

describe('Public Research Sources & Platform Discovery', () => {
  describe('1. Configurable Source Registry', () => {
    it('contains all 10 initial discussion, creator, and publication platforms', () => {
      const sourceIds = DEFAULT_RESEARCH_SOURCES.map((s) => s.id);
      const expectedSources = [
        'reddit',
        'x_twitter',
        'substack',
        'patreon',
        'medium',
        'quora',
        'tradingview',
        'stocktwits',
        'trading_blogs',
        'trading_forums',
      ];

      for (const expected of expectedSources) {
        expect(sourceIds).toContain(expected);
      }
      expect(DEFAULT_RESEARCH_SOURCES.length).toBeGreaterThanOrEqual(10);
    });

    it('configures each source with category, accessMethod, and searchOperatorTemplate', () => {
      for (const source of DEFAULT_RESEARCH_SOURCES) {
        expect(source.id).toBeTruthy();
        expect(source.name).toBeTruthy();
        expect(source.category).toBeTruthy();
        expect(source.domains.length).toBeGreaterThan(0);
        expect(source.accessMethod).toBe('public_search');
        expect(source.enabled).toBe(true);
        expect(source.searchOperatorTemplate).toContain('site:');
      }
    });

    it('accurately identifies platform provenance from URLs and subdomains', () => {
      expect(identifySourcePlatform('https://reddit.com/r/Forex/comments/123')?.id).toBe('reddit');
      expect(identifySourcePlatform('https://old.reddit.com/r/Trading')?.id).toBe('reddit');
      expect(identifySourcePlatform('https://x.com/trader_desk/status/987')?.id).toBe('x_twitter');
      expect(identifySourcePlatform('https://twitter.com/analyst/status/456')?.id).toBe('x_twitter');
      expect(identifySourcePlatform('https://macroalpha.substack.com/p/gold')?.id).toBe('substack');
      expect(identifySourcePlatform('https://www.tradingview.com/chart/BTCUSD/123')?.id).toBe('tradingview');
      expect(identifySourcePlatform('https://patreon.com/forexsignals')?.id).toBe('patreon');
      expect(identifySourcePlatform('https://medium.com/@crypto/post-1')?.id).toBe('medium');
      expect(identifySourcePlatform('https://quora.com/What-is-best-discord')?.id).toBe('quora');
      expect(identifySourcePlatform('https://stocktwits.com/r/ForexRoom')?.id).toBe('stocktwits');
      expect(identifySourcePlatform('https://dailyfxblog.wordpress.com/chat')?.id).toBe('trading_blogs');
      expect(identifySourcePlatform('https://forexfactory.com/thread/1001')?.id).toBe('trading_forums');
      expect(identifySourcePlatform('https://babypips.com/community/thread/5')?.id).toBe('trading_forums');
      expect(identifySourcePlatform('https://randomunregistereddomain.com/page')).toBeUndefined();
    });

    it('supports custom registry creation, extension, and platform filtering', () => {
      const customRegistry = new SourceRegistry([
        {
          id: 'custom_forum',
          name: 'Custom Forum',
          category: 'trading_forums',
          domains: ['customtradingforum.com'],
          accessMethod: 'public_search',
          enabled: true,
          searchOperatorTemplate: 'site:customtradingforum.com',
        },
      ]);

      expect(customRegistry.getAllSources()).toHaveLength(1);
      expect(customRegistry.identifySource('https://customtradingforum.com/thread/42')?.id).toBe('custom_forum');

      const query = customRegistry.buildQuery('custom_forum', 'forex');
      expect(query).toBe('site:customtradingforum.com forex "discord.gg/"');
    });
  });

  describe('2. Query Planner Expansion & Multilingual Support', () => {
    it('generates source-specific search queries diversified across platforms', () => {
      const planner = new QueryPlanner(12);
      const plan = planner.generatePlan({
        topics: ['forex'],
        languages: ['en'],
        limit: 10,
        depth: 1,
      });

      expect(plan.length).toBeLessThanOrEqual(12);
      expect(plan.length).toBeGreaterThanOrEqual(4);

      // Verify platforms are tagged on planned queries
      const platforms = plan.map((p) => p.platform).filter(Boolean);
      expect(platforms).toContain('general_web');
      expect(platforms.some((p) => p !== 'general_web')).toBe(true);

      // Verify queries contain site: operators for source-specific searches
      const hasSiteQueries = plan.some((p) => p.query.includes('site:'));
      expect(hasSiteQueries).toBe(true);
    });

    it('respects targetPlatforms when explicitly requested', () => {
      const planner = new QueryPlanner(10);
      const plan = planner.generatePlan({
        topics: ['forex'],
        languages: ['en'],
        limit: 10,
        depth: 1,
        targetPlatforms: ['reddit', 'tradingview'],
      });

      for (const item of plan) {
        expect(['reddit', 'tradingview']).toContain(item.platform);
        expect(item.query.includes('site:reddit.com') || item.query.includes('site:tradingview.com')).toBe(true);
      }
    });

    it('preserves native multilingual search queries across all six languages', () => {
      const planner = new QueryPlanner(24);
      const languages = ['en', 'es', 'de', 'fr', 'pt', 'ar'] as const;

      for (const lang of languages) {
        const plan = planner.generatePlan({
          topics: ['forex'],
          languages: [lang],
          limit: 5,
          depth: 1,
        });

        expect(plan.length).toBeGreaterThan(0);
        expect(plan[0].language).toBe(lang);
        expect(plan[0].query).toBeTruthy();
      }
    });

    it('covers all 10 platform categories when job query budget is small (4 queries)', () => {
      const planner = new QueryPlanner(4);
      const plan = planner.generatePlan({
        topics: ['forex'],
        languages: ['en'],
        limit: 10,
        depth: 1,
      });

      expect(plan).toHaveLength(4);

      // Verify that the 4 queries collectively cover all 10 platform domains
      const combinedQueries = plan.map((p) => p.query).join(' ');
      const expectedDomains = [
        'reddit.com',
        'x.com',
        'tradingview.com',
        'stocktwits.com',
        'substack.com',
        'patreon.com',
        'medium.com',
        'quora.com',
        'forexfactory.com',
        'wordpress.com',
      ];

      for (const domain of expectedDomains) {
        expect(combinedQueries).toContain(domain);
      }
    });
  });

  describe('3. Link Extraction, Provenance & Deduplication', () => {
    it('extracts Discord invites and preserves platform provenance', () => {
      const text =
        'Join our premier Forex community on Reddit: https://discord.gg/fx-reddit-lounge with daily signals.';
      const sourceUrl = 'https://reddit.com/r/Forex/comments/abc123/official_discord';

      const extracted = extractDiscordInvites(text, sourceUrl, 'mock');
      expect(extracted).toHaveLength(1);
      expect(extracted[0].code).toBe('fx-reddit-lounge');
      expect(extracted[0].sourcePlatform).toBe('reddit');
      expect(extracted[0].sourcePlatformName).toBe('Reddit');
      expect(extracted[0].sourceCategory).toBe('discussion_forum');
      expect(extracted[0].sourceUrl).toBe(sourceUrl);
      expect(extracted[0].contextSnippet).toContain('https://discord.gg/fx-reddit-lounge');
      expect(extracted[0].discoveredAt).toBeTruthy();
    });

    it('deduplicates identical invite codes found on multiple platforms and merges provenance', async () => {
      const mockAdapter = new MockSearchAdapter();
      const orchestrator = new SearchOrchestrator({
        primaryProvider: mockAdapter,
        queryPlanner: new QueryPlanner(10),
        verifyInviteFn: verifyMockInvite,
      });

      // tv-scalpers exists in MOCK_FIXTURES on both TradingView and Reddit
      const outcome = await orchestrator.executeJob({
        topics: ['forex'],
        languages: ['en'],
        limit: 10,
        depth: 1,
      });

      const tvScalpersResult = outcome.results.find((r) => r.invite.code === 'tv-scalpers');
      expect(tvScalpersResult).toBeDefined();

      if (tvScalpersResult) {
        // Must contain multi-source provenance
        expect(tvScalpersResult.sources.length).toBeGreaterThanOrEqual(2);
        const sourcePlatforms = tvScalpersResult.sources.map((s) => s.sourcePlatform);
        expect(sourcePlatforms).toContain('tradingview');
        expect(sourcePlatforms).toContain('reddit');
      }
    });

    it('preserves exact source URLs and context snippets upon database round-trip', async () => {
      const repo = new InMemoryRepository();
      const testJobId = 'test-job-url-preservation';
      const sampleUrl = 'https://reddit.com/r/Forex/comments/test_preservation';
      const sampleSnippet = 'Join our active group https://discord.gg/fx-elite-club';

      const mockResult: RankedInviteResult = {
        invite: {
          code: 'fx-elite-club',
          canonicalUrl: 'https://discord.gg/fx-elite-club',
          status: 'valid',
          lastVerifiedAt: new Date().toISOString(),
        },
        sources: [
          {
            rawUrl: 'https://discord.gg/fx-elite-club',
            code: 'fx-elite-club',
            canonicalUrl: 'https://discord.gg/fx-elite-club',
            sourceUrl: sampleUrl,
            sourceDomain: 'reddit.com',
            sourcePlatform: 'reddit',
            sourcePlatformName: 'Reddit',
            sourceCategory: 'discussion_forum',
            provider: 'mock',
            discoveredAt: new Date().toISOString(),
            contextSnippet: sampleSnippet,
          },
        ],
        score: 90,
        scoreBreakdown: {
          topicRelevance: 35,
          inviteValidity: 20,
          languageMatch: 15,
          sourceCredibility: 10,
          freshness: 5,
          activitySignal: 5,
          total: 90,
          explanations: ['Valid match'],
        },
        detectedTopics: ['forex'],
        detectedLanguage: 'en',
        isVerifiedFact: true,
      };

      await repo.saveJob({
        id: testJobId,
        params: { topics: ['forex'], languages: ['en'], limit: 10, depth: 1 },
        mode: 'mock',
        status: 'completed',
        progress: {
          queriesPlanned: 1,
          queriesAttempted: 1,
          queriesSuccessful: 1,
          queriesFailed: 0,
          urlsDiscovered: 1,
          invitesExtracted: 1,
          uniqueInvites: 1,
          invitesChecked: 1,
          validInvites: 1,
          invalidInvites: 0,
          restrictedOrUnverified: 0,
          queriesExecuted: 1,
          invitesVerified: 1,
          validInvitesFound: 1,
          providerErrors: [],
        },
        results: [mockResult],
        createdAt: new Date().toISOString(),
      });
      await repo.saveResults(testJobId, [mockResult]);

      const retrievedResults = await repo.getJobResults(testJobId);
      expect(retrievedResults).toHaveLength(1);
      expect(retrievedResults[0].sources).toHaveLength(1);
      expect(retrievedResults[0].sources[0].sourceUrl).toBe(sampleUrl);
      expect(retrievedResults[0].sources[0].sourcePlatform).toBe('reddit');
      expect(retrievedResults[0].sources[0].contextSnippet).toBe(sampleSnippet);
    });
  });

  describe('4. Distinguishing Verified Invites from Potential Leads', () => {
    it('records potential community leads when search results discuss communities without invite links', async () => {
      const mockAdapter = new MockSearchAdapter();
      const orchestrator = new SearchOrchestrator({
        primaryProvider: mockAdapter,
        queryPlanner: new QueryPlanner(12),
        verifyInviteFn: verifyMockInvite,
      });

      const outcome = await orchestrator.executeJob({
        topics: ['forex'],
        languages: ['en'],
        limit: 10,
        depth: 1,
      });

      // MOCK_FIXTURES includes 'https://reddit.com/r/Forex/comments/no_invite_thread'
      // which has no invite link in the snippet
      expect(outcome.potentialLeads).toBeDefined();
      expect(outcome.potentialLeads!.length).toBeGreaterThan(0);

      const lead = outcome.potentialLeads?.find((l) => l.sourceUrl.includes('no_invite_thread'));
      expect(lead).toBeDefined();
      expect(lead?.hasConfirmedInvite).toBe(false);
      expect(lead?.sourcePlatform).toBe('reddit');
      expect(lead?.reason).toContain('no valid Discord invitation link was exposed');

      // Verify progress counters
      expect(outcome.progress.potentialLeadsCount).toBe(outcome.potentialLeads!.length);
      expect(outcome.progress.leadsWithoutInvite).toBe(outcome.potentialLeads!.length);
    });

    it('does not classify potential leads as verified communities', async () => {
      const mockAdapter = new MockSearchAdapter();
      const orchestrator = new SearchOrchestrator({
        primaryProvider: mockAdapter,
        queryPlanner: new QueryPlanner(10),
        verifyInviteFn: verifyMockInvite,
      });

      const outcome = await orchestrator.executeJob({
        topics: ['forex'],
        languages: ['en'],
        limit: 10,
        depth: 1,
      });

      // All items in outcome.results MUST have a valid or verifiable Discord invite
      for (const res of outcome.results) {
        expect(res.invite.code).toBeTruthy();
        expect(res.invite.canonicalUrl).toContain('discord.gg/');
      }
    });
  });

  describe('5. Expired and Invalid Link Handling', () => {
    it('marks expired invites discovered on platforms as expired_or_revoked', async () => {
      const verified = await verifyMockInvite('expired-community-link');
      expect(verified.status).toBe('expired_or_revoked');
      expect(verified.canonicalUrl).toBe('https://discord.gg/expired-community-link');
    });
  });

  describe('6. Dashboard & Fastify API Filtering by Source Platform', () => {
    it('GET /api/sources returns all registered sources', async () => {
      const server = buildServer(new InMemoryRepository());
      await server.ready();

      const res = await server.inject({
        method: 'GET',
        url: '/api/sources',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.sources).toHaveLength(10);
      expect(data.sources.map((s: any) => s.id)).toContain('reddit');
      expect(data.sources.map((s: any) => s.id)).toContain('tradingview');

      await server.close();
    });

    it('GET /api/results/:id?platform=reddit filters results by source platform', async () => {
      const repo = new InMemoryRepository();
      const testJobId = 'test-job-platform-filter';

      const mockResults: RankedInviteResult[] = [
        {
          invite: {
            code: 'fx-reddit-lounge',
            canonicalUrl: 'https://discord.gg/fx-reddit-lounge',
            status: 'valid',
            community: {
              id: 'g-reddit-1',
              name: 'Reddit Forex Lounge',
              approximateMemberCount: 14000,
            },
            lastVerifiedAt: new Date().toISOString(),
          },
          sources: [
            {
              rawUrl: 'https://discord.gg/fx-reddit-lounge',
              code: 'fx-reddit-lounge',
              canonicalUrl: 'https://discord.gg/fx-reddit-lounge',
              sourceUrl: 'https://reddit.com/r/Forex/123',
              sourceDomain: 'reddit.com',
              sourcePlatform: 'reddit',
              sourcePlatformName: 'Reddit',
              provider: 'mock',
              discoveredAt: new Date().toISOString(),
            },
          ],
          score: 90,
          scoreBreakdown: {
            topicRelevance: 35,
            inviteValidity: 20,
            languageMatch: 15,
            sourceCredibility: 10,
            freshness: 5,
            activitySignal: 5,
            total: 90,
            explanations: ['Reddit community match'],
          },
          detectedTopics: ['forex'],
          detectedLanguage: 'en',
          isVerifiedFact: true,
        },
        {
          invite: {
            code: 'tv-scalpers',
            canonicalUrl: 'https://discord.gg/tv-scalpers',
            status: 'valid',
            community: {
              id: 'g-tv-1',
              name: 'TradingView Scalpers',
              approximateMemberCount: 18000,
            },
            lastVerifiedAt: new Date().toISOString(),
          },
          sources: [
            {
              rawUrl: 'https://discord.gg/tv-scalpers',
              code: 'tv-scalpers',
              canonicalUrl: 'https://discord.gg/tv-scalpers',
              sourceUrl: 'https://tradingview.com/chart/123',
              sourceDomain: 'tradingview.com',
              sourcePlatform: 'tradingview',
              sourcePlatformName: 'TradingView',
              provider: 'mock',
              discoveredAt: new Date().toISOString(),
            },
          ],
          score: 92,
          scoreBreakdown: {
            topicRelevance: 35,
            inviteValidity: 20,
            languageMatch: 15,
            sourceCredibility: 10,
            freshness: 6,
            activitySignal: 6,
            total: 92,
            explanations: ['TradingView community match'],
          },
          detectedTopics: ['forex'],
          detectedLanguage: 'en',
          isVerifiedFact: true,
        },
      ];

      await repo.saveJob({
        id: testJobId,
        params: { topics: ['forex'], languages: ['en'], limit: 10, depth: 1 },
        mode: 'mock',
        status: 'completed',
        progress: {
          queriesPlanned: 2,
          queriesAttempted: 2,
          queriesSuccessful: 2,
          queriesFailed: 0,
          urlsDiscovered: 2,
          invitesExtracted: 2,
          uniqueInvites: 2,
          invitesChecked: 2,
          validInvites: 2,
          invalidInvites: 0,
          restrictedOrUnverified: 0,
          queriesExecuted: 2,
          invitesVerified: 2,
          validInvitesFound: 2,
          providerErrors: [],
        },
        results: mockResults,
        createdAt: new Date().toISOString(),
      });
      await repo.saveResults(testJobId, mockResults);

      const server = buildServer(repo);
      await server.ready();

      // Query without filter -> returns both results
      const resAll = await server.inject({
        method: 'GET',
        url: `/api/results/${testJobId}`,
      });
      expect(resAll.statusCode).toBe(200);
      const dataAll = JSON.parse(resAll.payload);
      expect(dataAll.results).toHaveLength(2);

      // Query with platform=reddit -> returns only reddit result
      const resReddit = await server.inject({
        method: 'GET',
        url: `/api/results/${testJobId}?platform=reddit`,
      });
      expect(resReddit.statusCode).toBe(200);
      const dataReddit = JSON.parse(resReddit.payload);
      expect(dataReddit.results).toHaveLength(1);
      expect(dataReddit.results[0].invite.code).toBe('fx-reddit-lounge');

      // Query with platform=tradingview -> returns only tradingview result
      const resTv = await server.inject({
        method: 'GET',
        url: `/api/results/${testJobId}?platform=tradingview`,
      });
      expect(resTv.statusCode).toBe(200);
      const dataTv = JSON.parse(resTv.payload);
      expect(dataTv.results).toHaveLength(1);
      expect(dataTv.results[0].invite.code).toBe('tv-scalpers');

      await server.close();
    });
  });

  describe('7. API Limitations and Zero Credit Spending Guarantees', () => {
    it('guarantees tests consume zero paid provider credits and zero live Discord network calls', async () => {
      const serperSpy = vi.fn();
      const tavilySpy = vi.fn();

      const mockAdapter = new MockSearchAdapter();
      const searchSpy = vi.spyOn(mockAdapter, 'search');

      const orchestrator = new SearchOrchestrator({
        primaryProvider: mockAdapter,
        queryPlanner: new QueryPlanner(5),
        verifyInviteFn: verifyMockInvite,
      });

      const outcome = await orchestrator.executeJob({
        topics: ['forex'],
        languages: ['en'],
        limit: 5,
        depth: 1,
      });

      // Serper and Tavily were never called
      expect(serperSpy).toHaveBeenCalledTimes(0);
      expect(tavilySpy).toHaveBeenCalledTimes(0);

      // Mock search was called locally
      expect(searchSpy).toHaveBeenCalled();
      expect(outcome.results.length).toBeGreaterThan(0);
    });
  });
});
