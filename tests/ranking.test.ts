import { describe, it, expect } from 'vitest';
import {
  calculateInviteScore,
  compareRankedResults,
  RankedInviteResult,
  rankInviteResults,
} from '../packages/core/src/index.js';

describe('Ranking and Scoring Engine', () => {
  it('awards full points for high-match verified active communities', () => {
    const verifiedInvite = {
      code: 'elite-fx',
      canonicalUrl: 'https://discord.gg/elite-fx',
      status: 'valid' as const,
      community: {
        id: '12345',
        name: 'Elite Forex Scalping',
        description: 'Forex signals, trading education, and currency analysis.',
        approximateMemberCount: 6500,
      },
      lastVerifiedAt: new Date().toISOString(),
    };

    const sources = [
      {
        rawUrl: 'https://discord.gg/elite-fx',
        code: 'elite-fx',
        canonicalUrl: 'https://discord.gg/elite-fx',
        sourceUrl: 'https://fx-hub.com',
        sourceDomain: 'fx-hub.com',
        provider: 'mock' as const,
        discoveredAt: new Date().toISOString(),
        contextSnippet: 'Join elite forex scalping Discord community',
      },
      {
        rawUrl: 'https://discord.gg/elite-fx',
        code: 'elite-fx',
        canonicalUrl: 'https://discord.gg/elite-fx',
        sourceUrl: 'https://tradingdirectory.org',
        sourceDomain: 'tradingdirectory.org',
        provider: 'mock' as const,
        discoveredAt: new Date().toISOString(),
      },
    ];

    const { score, scoreBreakdown } = calculateInviteScore(verifiedInvite, sources, ['forex'], ['en']);

    expect(score).toBeGreaterThanOrEqual(90);
    expect(scoreBreakdown.topicRelevance).toBeGreaterThanOrEqual(30);
    expect(scoreBreakdown.inviteValidity).toBe(20);
    expect(scoreBreakdown.languageMatch).toBe(15);
    expect(scoreBreakdown.sourceCredibility).toBe(10);
    expect(scoreBreakdown.activitySignal).toBe(10);
  });

  it('handles missing member count neutrally without awarding fictional points', () => {
    const hiddenInvite = {
      code: 'private-community',
      canonicalUrl: 'https://discord.gg/private-community',
      status: 'valid' as const,
      community: {
        id: '99999',
        name: 'Private Traders Club',
        approximateMemberCount: null, // Hidden/unavailable
      },
      lastVerifiedAt: new Date().toISOString(),
    };

    const { scoreBreakdown } = calculateInviteScore(hiddenInvite, [], ['forex'], ['en']);
    expect(scoreBreakdown.activitySignal).toBe(0);
    expect(scoreBreakdown.explanations.some((e) => e.includes('private or not provided'))).toBe(true);
  });

  it('ranks higher scoring communities ahead of lower ones', () => {
    const list = [
      {
        invite: {
          code: 'low-score',
          canonicalUrl: 'https://discord.gg/low-score',
          status: 'expired_or_revoked' as const,
          community: {
            id: '2',
            name: 'Forex Alerts Revoked',
            description: 'English forex alerts and currency trading community.',
          },
          lastVerifiedAt: new Date().toISOString(),
        },
        sources: [],
      },
      {
        invite: {
          code: 'high-score',
          canonicalUrl: 'https://discord.gg/high-score',
          status: 'valid' as const,
          community: {
            id: '1',
            name: 'Forex Pros Official',
            description: 'Welcome to the official English forex trading community for traders.',
            approximateMemberCount: 5000,
          },
          lastVerifiedAt: new Date().toISOString(),
        },
        sources: [],
      },
    ];

    const ranked = rankInviteResults(list, ['forex'], ['en']);
    expect(ranked[0].invite.code).toBe('high-score');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('strictly places a score of 95 above a score of 92 using compareRankedResults', () => {
    const item92: RankedInviteResult = {
      invite: {
        code: 'fx-elite-club',
        canonicalUrl: 'https://discord.gg/fx-elite-club',
        status: 'valid',
        community: { id: '1', name: 'FX Elite', approximateMemberCount: 4500 },
        lastVerifiedAt: new Date().toISOString(),
      },
      sources: [],
      score: 92,
      scoreBreakdown: {
        topicRelevance: 35,
        inviteValidity: 20,
        languageMatch: 15,
        sourceCredibility: 7,
        freshness: 10,
        activitySignal: 5,
        total: 92,
        explanations: [],
      },
      detectedTopics: ['forex'],
      detectedLanguage: 'en',
      isVerifiedFact: true,
    };

    const item95: RankedInviteResult = {
      invite: {
        code: 'gold-scalpers-vip',
        canonicalUrl: 'https://discord.gg/gold-scalpers-vip',
        status: 'valid',
        community: { id: '2', name: 'Gold Scalpers', approximateMemberCount: 8200 },
        lastVerifiedAt: new Date().toISOString(),
      },
      sources: [],
      score: 95,
      scoreBreakdown: {
        topicRelevance: 35,
        inviteValidity: 20,
        languageMatch: 15,
        sourceCredibility: 7,
        freshness: 10,
        activitySignal: 8,
        total: 95,
        explanations: [],
      },
      detectedTopics: ['xauusd'],
      detectedLanguage: 'en',
      isVerifiedFact: true,
    };

    // Even if initial array has item 92 before item 95
    const results = [item92, item95];
    results.sort(compareRankedResults);

    expect(results[0].score).toBe(95);
    expect(results[0].invite.code).toBe('gold-scalpers-vip');
    expect(results[1].score).toBe(92);
    expect(results[1].invite.code).toBe('fx-elite-club');
  });

  it('penalizes expired or revoked invites so they cannot outrank active communities', () => {
    const expiredInvite = {
      code: 'expired-signals',
      canonicalUrl: 'https://discord.gg/expired-signals',
      status: 'expired_or_revoked' as const,
      lastVerifiedAt: new Date().toISOString(),
    };

    const activeInvite = {
      code: 'active-signals',
      canonicalUrl: 'https://discord.gg/active-signals',
      status: 'valid' as const,
      community: { id: '10', name: 'Active Signals', approximateMemberCount: 500 },
      lastVerifiedAt: new Date().toISOString(),
    };

    const expiredScore = calculateInviteScore(expiredInvite, [], ['forex'], ['en']);
    const activeScore = calculateInviteScore(activeInvite, [], ['forex'], ['en']);

    expect(expiredScore.scoreBreakdown.inviteValidity).toBeLessThan(0);
    expect(activeScore.score).toBeGreaterThan(expiredScore.score);
  });
});

