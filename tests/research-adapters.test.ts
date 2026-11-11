import { describe, it, expect, vi } from 'vitest';
import { SerperAdapter, TavilyAdapter, MockSearchAdapter, SearchOrchestrator } from '../packages/research/src/index.js';

describe('Research Adapters & Fallback Orchestration', () => {
  it('parses successful Serper organic responses correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        organic: [
          {
            title: 'Forex Community Discord',
            link: 'https://discord.gg/fx-pro',
            snippet: 'Join our forex trading community on Discord: https://discord.gg/fx-pro',
            date: '2026-03-01',
          },
        ],
      }),
    });

    const serper = new SerperAdapter('dummy-key', 50, mockFetch as any);
    const result = await serper.search('forex discord');

    expect(result.statusCode).toBe(200);
    expect(result.items.length).toBe(1);
    expect(result.items[0].url).toBe('https://discord.gg/fx-pro');
    expect(result.items[0].title).toBe('Forex Community Discord');
  });

  it('handles Serper 429 rate limiting gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    const serper = new SerperAdapter('dummy-key', 50, mockFetch as any);
    const result = await serper.search('forex discord');

    expect(result.statusCode).toBe(429);
    expect(result.error).toContain('rate limit');
    expect(result.items.length).toBe(0);
  });

  it('parses successful Tavily responses correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            title: 'Gold Scalping Server',
            url: 'https://discord.com/invite/gold-scalp',
            content: 'Daily gold scalping discussion: https://discord.gg/gold-scalp',
            published_date: '2026-04-10',
          },
        ],
      }),
    });

    const tavily = new TavilyAdapter('dummy-key', 50, mockFetch as any);
    const result = await tavily.search('gold discord');

    expect(result.statusCode).toBe(200);
    expect(result.items.length).toBe(1);
    expect(result.items[0].url).toBe('https://discord.com/invite/gold-scalp');
  });

  it('orchestrator falls back to secondary provider if primary fails', async () => {
    const failingPrimary = {
      name: 'serper' as const,
      isAvailable: () => true,
      getDailyRequestCount: () => 1,
      search: vi.fn().mockResolvedValue({
        provider: 'serper' as const,
        query: 'test',
        items: [],
        statusCode: 500,
        durationMs: 10,
        error: 'Serper outage',
      }),
    };

    const workingSecondary = {
      name: 'tavily' as const,
      isAvailable: () => true,
      getDailyRequestCount: () => 1,
      search: vi.fn().mockResolvedValue({
        provider: 'tavily' as const,
        query: 'test',
        items: [
          {
            title: 'Fallback Hit',
            url: 'https://discord.gg/fallback-hit',
            snippet: 'Join https://discord.gg/fallback-hit',
          },
        ],
        statusCode: 200,
        durationMs: 10,
      }),
    };

    const orchestrator = new SearchOrchestrator({
      primaryProvider: failingPrimary as any,
      secondaryProvider: workingSecondary as any,
      verifyInviteFn: async (code) => ({
        code,
        canonicalUrl: `https://discord.gg/${code}`,
        status: 'valid',
        lastVerifiedAt: new Date().toISOString(),
      }),
    });

    const outcome = await orchestrator.executeJob({
      topics: ['forex'],
      languages: ['en'],
      limit: 5,
      depth: 1,
    });

    expect(workingSecondary.search).toHaveBeenCalled();
    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results[0].invite.code).toBe('fallback-hit');
  });
});

