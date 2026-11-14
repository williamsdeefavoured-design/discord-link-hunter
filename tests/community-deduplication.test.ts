import { describe, it, expect } from 'vitest';
import {
  deduplicateCommunityResults,
  rankInviteResults,
  RankedInviteResult,
  VerifiedInvite,
  DiscoveredInvite,
} from '../packages/core/src/index.js';

describe('Phase 4 — Community Deduplication by Discord Guild ID', () => {
  const createMockInvite = (
    code: string,
    guildId?: string,
    serverName = 'Test Trading Server',
    members = 5000,
    status: VerifiedInvite['status'] = 'valid'
  ): VerifiedInvite => ({
    code,
    canonicalUrl: `https://discord.gg/${code}`,
    status,
    community: guildId
      ? {
          id: guildId,
          name: serverName,
          description: 'Forex, Gold, and XAUUSD trading strategies',
          approximateMemberCount: members,
          approximatePresenceCount: Math.round(members * 0.2),
        }
      : null,
    lastVerifiedAt: new Date().toISOString(),
  });

  const createMockSource = (
    code: string,
    sourceUrl: string,
    platform: string
  ): DiscoveredInvite => ({
    rawUrl: `https://discord.gg/${code}`,
    code,
    canonicalUrl: `https://discord.gg/${code}`,
    sourceUrl,
    sourceDomain: new URL(sourceUrl).hostname,
    sourcePlatform: platform,
    sourcePlatformName: platform,
    provider: 'mock',
    discoveredAt: new Date().toISOString(),
    contextSnippet: 'High probability forex and xauusd trading signals',
  });

  it('merges two different invite codes for the same guild ID into a single community', () => {
    const inviteA = createMockInvite('forex-vip', 'guild-111111', 'Alpha Forex Trading', 12000, 'valid');
    const sourceA = createMockSource('forex-vip', 'https://reddit.com/r/forex/post1', 'reddit');

    const inviteB = createMockInvite('forex-general', 'guild-111111', 'Alpha Forex Trading', 12000, 'valid');
    const sourceB = createMockSource('forex-general', 'https://twitter.com/trader/status/2', 'x_twitter');

    const resultA: RankedInviteResult = {
      invite: inviteA,
      sources: [sourceA],
      score: 95,
      scoreBreakdown: {
        topicRelevance: 35,
        inviteValidity: 20,
        languageMatch: 15,
        sourceCredibility: 10,
        freshness: 8,
        activitySignal: 7,
        total: 95,
        explanations: ['Alpha Forex'],
      },
      detectedTopics: ['forex', 'xauusd'],
      detectedLanguage: 'en',
      isVerifiedFact: true,
    };

    const resultB: RankedInviteResult = {
      invite: inviteB,
      sources: [sourceB],
      score: 90,
      scoreBreakdown: {
        topicRelevance: 30,
        inviteValidity: 20,
        languageMatch: 15,
        sourceCredibility: 10,
        freshness: 8,
        activitySignal: 7,
        total: 90,
        explanations: ['Alpha Forex general'],
      },
      detectedTopics: ['forex'],
      detectedLanguage: 'en',
      isVerifiedFact: true,
    };

    const deduplicated = deduplicateCommunityResults([resultA, resultB]);

    // Exactly one community result retained
    expect(deduplicated).toHaveLength(1);
    const primary = deduplicated[0];

    // Retains highest-scoring invite as primary
    expect(primary.invite.code).toBe('forex-vip');
    expect(primary.score).toBe(95);

    // Alternative invite code is preserved
    expect(primary.alternateInviteCodes).toBeDefined();
    expect(primary.alternateInviteCodes).toContain('forex-general');

    // Multi-source provenance is merged across both invitations
    expect(primary.sources).toHaveLength(2);
    const platforms = primary.sources.map((s) => s.sourcePlatform);
    expect(platforms).toContain('reddit');
    expect(platforms).toContain('x_twitter');
  });

  it('NEVER merges two distinct guilds sharing the same server name and member count', () => {
    // Two independent Discord guilds happened to name themselves "Forex Elite Traders"
    const guild1 = createMockInvite('fx-elite-1', 'guild-alpha-999', 'Forex Elite Traders', 8500, 'valid');
    const source1 = createMockSource('fx-elite-1', 'https://reddit.com/r/forex/1', 'reddit');

    const guild2 = createMockInvite('fx-elite-2', 'guild-beta-888', 'Forex Elite Traders', 8500, 'valid');
    const source2 = createMockSource('fx-elite-2', 'https://tradingview.com/ideas/2', 'tradingview');

    const result1: RankedInviteResult = {
      invite: guild1,
      sources: [source1],
      score: 88,
      scoreBreakdown: {
        topicRelevance: 30,
        inviteValidity: 20,
        languageMatch: 15,
        sourceCredibility: 8,
        freshness: 8,
        activitySignal: 7,
        total: 88,
        explanations: ['Guild 1'],
      },
      detectedTopics: ['forex'],
      detectedLanguage: 'en',
      isVerifiedFact: true,
    };

    const result2: RankedInviteResult = {
      invite: guild2,
      sources: [source2],
      score: 85,
      scoreBreakdown: {
        topicRelevance: 27,
        inviteValidity: 20,
        languageMatch: 15,
        sourceCredibility: 8,
        freshness: 8,
        activitySignal: 7,
        total: 85,
        explanations: ['Guild 2'],
      },
      detectedTopics: ['forex'],
      detectedLanguage: 'en',
      isVerifiedFact: true,
    };

    const deduplicated = deduplicateCommunityResults([result1, result2]);

    // Both distinct guilds must be preserved individually
    expect(deduplicated).toHaveLength(2);
    expect(deduplicated[0].invite.community?.id).toBe('guild-alpha-999');
    expect(deduplicated[1].invite.community?.id).toBe('guild-beta-888');
    expect(deduplicated[0].invite.code).toBe('fx-elite-1');
    expect(deduplicated[1].invite.code).toBe('fx-elite-2');
  });

  it('preserves invites without guild ID individually by invite code', () => {
    const unverified1 = createMockInvite('unverified-link-1', undefined, '', 0, 'unknown');
    const source1 = createMockSource('unverified-link-1', 'https://reddit.com/r/trading/1', 'reddit');

    const unverified2 = createMockInvite('unverified-link-2', undefined, '', 0, 'unknown');
    const source2 = createMockSource('unverified-link-2', 'https://reddit.com/r/trading/2', 'reddit');

    const result1: RankedInviteResult = {
      invite: unverified1,
      sources: [source1],
      score: 30,
      scoreBreakdown: {
        topicRelevance: 20,
        inviteValidity: 0,
        languageMatch: 10,
        sourceCredibility: 0,
        freshness: 0,
        activitySignal: 0,
        total: 30,
        explanations: [],
      },
      detectedTopics: ['forex'],
      detectedLanguage: 'en',
      isVerifiedFact: false,
    };

    const result2: RankedInviteResult = {
      invite: unverified2,
      sources: [source2],
      score: 30,
      scoreBreakdown: {
        topicRelevance: 20,
        inviteValidity: 0,
        languageMatch: 10,
        sourceCredibility: 0,
        freshness: 0,
        activitySignal: 0,
        total: 30,
        explanations: [],
      },
      detectedTopics: ['forex'],
      detectedLanguage: 'en',
      isVerifiedFact: false,
    };

    const deduplicated = deduplicateCommunityResults([result1, result2]);
    expect(deduplicated).toHaveLength(2);
    expect(deduplicated[0].invite.code).toBe('unverified-link-1');
    expect(deduplicated[1].invite.code).toBe('unverified-link-2');
  });

  it('integrates deduplication directly into rankInviteResults pipeline', () => {
    const invite1 = createMockInvite('code-main', 'guild-shared-444', 'Gold Pros', 20000, 'valid');
    const source1 = createMockSource('code-main', 'https://reddit.com/r/gold/1', 'reddit');

    const invite2 = createMockInvite('code-backup', 'guild-shared-444', 'Gold Pros', 20000, 'valid');
    const source2 = createMockSource('code-backup', 'https://substack.com/post/2', 'substack');

    const ranked = rankInviteResults(
      [
        { invite: invite1, sources: [source1] },
        { invite: invite2, sources: [source2] },
      ],
      ['forex', 'xauusd'],
      ['en']
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].invite.community?.id).toBe('guild-shared-444');
    const allCodes = [ranked[0].invite.code, ...(ranked[0].alternateInviteCodes || [])];
    expect(allCodes).toContain('code-main');
    expect(allCodes).toContain('code-backup');
    expect(ranked[0].sources).toHaveLength(2);
  });
});
