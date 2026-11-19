import { describe, expect, it, vi } from 'vitest';
import { detectCountryEvidence, detectLanguageEvidence, getSelectableCountries, matchesCountryFilter, rankInviteResults, type VerifiedInvite } from '../packages/core/src/index.js';
import { SearchOrchestrator } from '../packages/research/src/orchestrator.js';

const inviteUrl = 'https://discord.gg/fixture';
const verifiedAt = '2026-01-01T00:00:00Z';

function invite(code: string, description: string, members?: number): VerifiedInvite {
  return {
    code, canonicalUrl: 'https://discord.gg/' + code, status: 'valid', lastVerifiedAt: verifiedAt,
    community: { id: code, name: 'Markets', description, approximateMemberCount: members },
  };
}

describe('Discovery country evidence', () => {
  it('supports non-African ISO options and preserves unrestricted discovery', () => {
    const codes = getSelectableCountries().map(({ code }) => code);
    expect(codes).toContain('LI');
    expect(codes).not.toContain('NG');
    expect(matchesCountryFilter(undefined, 'all')).toBe(true);
    expect(matchesCountryFilter(detectCountryEvidence('We are based in Nigeria.', inviteUrl), 'all')).toBe(true);
  });

  it('separates self-declarations from independently verified evidence', () => {
    const evidence = detectCountryEvidence('Our community is based in France.', inviteUrl);
    expect(evidence).toMatchObject({ status: 'self_declared', countryCode: 'FR', sourceUrl: inviteUrl });
    expect(matchesCountryFilter(evidence, 'FR')).toBe(true);
    expect(matchesCountryFilter(evidence, 'DE')).toBe(false);
    expect(matchesCountryFilter({ ...evidence, status: 'verified', sourceUrl: 'https://example.org/guild-registry' }, 'FR')).toBe(true);
    expect(matchesCountryFilter(undefined, 'FR')).toBe(false);
  });

  it('rejects language, unrelated locations, ccTLDs, and conflicting claims', () => {
    for (const text of ['Communauté de trading francophone.', 'We discuss companies based in France.', 'We are based in France. We are based in Germany.']) {
      expect(detectCountryEvidence(text, 'https://example.fr/post')).toMatchObject({
        status: 'unknown', countryCode: null, lastVerifiedAt: null, sourceUrl: null,
      });
    }
  });

  it('applies independent country and language criteria to actual ranked results', () => {
    const results = rankInviteResults([
      { invite: invite('english-fr', 'Our community is based in France. Welcome to our stock market discussion.'), sources: [] },
      { invite: invite('english-de', 'Our community is based in Germany. Welcome to our stock market discussion.'), sources: [] },
      { invite: invite('english-unknown', 'Welcome to our stock market discussion.'), sources: [] },
    ], ['stocks'], ['en'], { country: 'FR' });
    expect(results.map((result) => result.invite.code)).toEqual(['english-fr']);
  });
});

it.each([
  ['Benvenuti nella nostra comunità. Analisi tecnica e mercato azionario.', 'it'],
  ['Türkçe konuşan yatırımcılar için döviz piyasası ve teknik analiz.', 'tr'],
  ['Welkom bij onze gemeenschap voor beleggers met technische analyse en aandelen.', 'nl'],
])('classifies localized public content as %s', (text, language) => {
  expect(detectLanguageEvidence(text).language).toBe(language);
});

describe('Exact discovery source and membership constraints', () => {
  const x = 'https://x.com/fixture/status/1';
  const reddit = 'https://reddit.com/r/fixture/comments/2';
  const makeOrchestrator = () => {
    const search = vi.fn(async (query: string) => ({
      provider: 'serper' as const, query, statusCode: 200, durationMs: 1,
      items: [x, reddit].map((url) => ({
        url, title: 'Stock market community',
        snippet: 'https://discord.gg/large https://discord.gg/small https://discord.gg/missing',
      })),
    }));
    return {
      search,
      orchestrator: new SearchOrchestrator({
        primaryProvider: { name: 'serper', search, isAvailable: () => true, getDailyRequestCount: () => 0 },
        verifyInviteFn: async (code) => invite(code, 'Welcome to our stock market discussion.', code === 'large' ? 100 : code === 'small' ? 99 : undefined),
      }),
    };
  };

  it.each([
    [['x_twitter'], [x]],
    [['reddit'], [reddit]],
    [['x_twitter', 'reddit'], [x, reddit]],
  ])('retains only selected original sources for %j', async (targetPlatforms, expected) => {
    const { search, orchestrator } = makeOrchestrator();
    const output = await orchestrator.executeJob({
      topics: ['stocks'], languages: ['en'], limit: 5, depth: 1, minMembers: 100, targetPlatforms,
    });
    expect(search).toHaveBeenCalled();
    expect(search.mock.calls.every(([query]) => query.includes('site:'))).toBe(true);
    expect(output.results.map((item) => item.invite.code)).toEqual(['large']);
    expect([...new Set(output.results[0].sources.map((source) => source.sourceUrl))].sort()).toEqual([...expected].sort());
  });
});

describe('Bounded verification when early invites fail relevance', () => {
  const codes = ['first', 'second', 'third', 'fourth', 'fifth'];
  const params = { topics: ['indices'] as const, languages: ['pt'] as const, limit: 1, depth: 1 };
  function makeSearch(verifyInviteFn: (code: string) => Promise<VerifiedInvite>) {
    const search = vi.fn(async (query: string) => ({
      provider: 'serper' as const, query, statusCode: 200, durationMs: 1,
      items: [{
        url: 'https://reddit.com/r/markets/comments/example',
        title: 'Discord communities',
        snippet: codes.map((code) => 'https://discord.gg/' + code).join(' '),
      }],
    }));
    return new SearchOrchestrator({
      primaryProvider: { name: 'serper', search, isAvailable: () => true, getDailyRequestCount: () => 0 },
      verifyInviteFn,
    }).executeJob({ ...params, topics: [...params.topics], languages: [...params.languages] });
  }

  it('looks beyond the first two checks and keeps the topic and language filters', async () => {
    const verify = vi.fn(async (code: string) => invite(code, code === 'third'
      ? 'Bem vindos à nossa comunidade de investidores. Análise e operações de mini índice.'
      : 'Welcome to our stock market discussion.'));
    const result = await makeSearch(verify);

    expect(result.results.map(({ invite }) => invite.code)).toEqual(['third']);
    expect(result.progress).toMatchObject({ invitesChecked: 3, uncheckedInvites: 2, languageFilteredOutCount: 2 });
    expect(verify).toHaveBeenCalledTimes(3);
  });

  it('caps additional checks when none of the invites qualify', async () => {
    const result = await makeSearch(async (code) => invite(code, 'Welcome to our stock market discussion.'));

    expect(result.results).toEqual([]);
    expect(result.progress).toMatchObject({ invitesChecked: 4, uncheckedInvites: 1 });
  });

  it('stops when Discord reports a verification rate limit', async () => {
    const result = await makeSearch(async (code) => ({
      ...invite(code, 'Welcome to our stock market discussion.'), status: 'rate_limited',
    }));

    expect(result.progress).toMatchObject({ invitesChecked: 1, uncheckedInvites: 4, discordVerificationRateLimited: true });
  });
});
