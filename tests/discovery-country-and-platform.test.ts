import { describe, expect, it, vi } from 'vitest';
import { detectCountryEvidence, detectLanguageEvidence, getSelectableCountries, matchesCountryFilter, rankInviteResults, type VerifiedInvite } from '../packages/core/src/index.js';
import { getDefaultSourceRegistry } from '../packages/core/src/sources.js';
import { QueryPlanner } from '../packages/research/src/query-planner.js';
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
    expect(output.progress).toMatchObject({
      sourceHits: search.mock.calls.length * 2, urlsDiscovered: expected.length,
      uniqueInvites: 3, invitesChecked: 3, validInvites: 3, qualifiedCommunities: 1,
    });
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

it('covers every selected topic, language and platform in the initial all-filters plan', () => {
  const topics = ['forex', 'xauusd', 'stocks', 'crypto', 'futures', 'options', 'indices',
    'day_trading', 'swing_trading', 'technical_analysis', 'investing', 'education'] as const;
  const languages = ['en', 'de', 'es', 'pt', 'fr', 'ar', 'it', 'tr', 'nl'] as const;
  const targetPlatforms = getDefaultSourceRegistry().getActiveSources().map(({ id }) => id);
  const planner = new QueryPlanner(12);
  const params = { topics: [...topics], languages: [...languages], targetPlatforms, country: 'FR', limit: 50, depth: 1 };
  const plan = planner.generatePlan(params);
  const expanded = planner.generatePlan(params, 24);

  expect(plan).toHaveLength(12);
  expect(new Set(plan.map(({ topic }) => topic))).toEqual(new Set(topics));
  expect(new Set(plan.map(({ language }) => language))).toEqual(new Set(languages));
  expect(new Set(plan.flatMap(({ platform }) => platform?.split(',') ?? []))).toEqual(new Set(targetPlatforms));
  expect(plan.every(({ query }) => query.includes('"France"'))).toBe(true);
  expect(expanded).toHaveLength(24);
  expect(expanded.slice(0, plan.length)).toEqual(plan);
});

it.each([false, true])('handles a failing provider alongside a successful empty search (primary fails: %s)', async (primaryFails) => {
  const emptySearch = vi.fn(async (query: string) => ({
    provider: 'serper' as const, query, statusCode: 200, durationMs: 1, items: [],
  }));
  const failedSearch = vi.fn(async () => { throw new Error('Provider timed out'); });
  const provider = { isAvailable: () => true, getDailyRequestCount: () => 0 };
  const output = await new SearchOrchestrator({
    primaryProvider: { ...provider, name: 'serper', search: primaryFails ? failedSearch : emptySearch },
    secondaryProvider: { ...provider, name: 'tavily', search: primaryFails ? emptySearch : failedSearch },
    queryPlanner: new QueryPlanner(1),
  }).executeJob({ topics: ['forex'], languages: ['en'], targetPlatforms: ['reddit'], limit: 1, depth: 1 });

  expect(output.results).toEqual([]);
  expect(output.progress).toMatchObject({ queriesSuccessful: 2, queriesFailed: 0 });
  expect(output.progress.providerErrors[0]?.error).toBe('Provider timed out');
});

it('widens a regional search and keeps unconfirmed matches separate', async () => {
  const search = vi.fn(async (query: string) => ({
    provider: 'serper' as const, query, statusCode: 200, durationMs: 1,
    items: [{
      url: 'https://reddit.com/r/markets/comments/' + search.mock.calls.length,
      title: 'Discord community',
      snippet: 'https://discord.gg/' + (search.mock.calls.length === 1 ? 'unknown' : 'france'),
    }],
  }));
  const stages: string[] = [];
  const output = await new SearchOrchestrator({
    primaryProvider: { name: 'serper', search, isAvailable: () => true, getDailyRequestCount: () => 0 },
    queryPlanner: new QueryPlanner(1),
    verifyInviteFn: async (code) => invite(code, 'Welcome to our stock market discussion. ' +
      (code === 'france' ? 'We are based in France.' : '')),
  }).executeJob({ topics: ['stocks'], languages: ['en'], country: 'FR', limit: 1, depth: 1 }, (progress) => {
    if (progress.stage) stages.push(progress.stage);
  });
  expect(search).toHaveBeenCalledTimes(2);
  expect(output.results.map(({ invite }) => invite.code)).toEqual(['france']);
  expect(output.progress.countryUnconfirmed?.map(({ invite }) => invite.code)).toEqual(['unknown']);
  expect([...new Set(stages)]).toEqual(['searching', 'widening', 'verifying', 'saving']);
});

it('retains working invites in broad discovery when strict preferences would hide them', async () => {
  const search = vi.fn(async (query: string) => ({
    provider: 'serper' as const, query, statusCode: 200, durationMs: 1,
    items: [{ url: 'https://reddit.com/r/markets/comments/example', title: 'Discord community',
      snippet: 'https://discord.gg/broad-match' }],
  }));
  const output = await new SearchOrchestrator({
    primaryProvider: { name: 'serper', search, isAvailable: () => true, getDailyRequestCount: () => 0 },
    queryPlanner: new QueryPlanner(1),
    includeBroadMatches: true,
    verifyInviteFn: async (code) => invite(code, 'Welcome to our stock market discussion.'),
  }).executeJob({ topics: ['forex'], languages: ['en'], country: 'FR', limit: 1, depth: 1 });
  expect(output.results.map(({ invite }) => invite.code)).toEqual(['broad-match']);
  expect(output.results[0].scoreBreakdown.preferenceMatch).toBe(false);
  expect(output.progress).toMatchObject({ qualifiedCommunities: 0, broadMatchesShown: 1 });
});

it.each([[5, 36], [10, 60], [20, 96]])('plans up to %i× discovery with the expanded query budget (%i)', async (depth, expected) => {
  const search = vi.fn();
  const result = await new SearchOrchestrator({
    primaryProvider: { name: 'serper', search, isAvailable: () => true, getDailyRequestCount: () => 0 },
  }).executeJob({ topics: ['forex'], languages: ['en'], limit: depth, depth, dryRun: true });

  expect(result.plannedQueries).toHaveLength(expected);
  expect(search).not.toHaveBeenCalled();
});

it('keeps exact then broader active results, rejects unrelated guilds, and caps provider calls', async () => {
  const search = vi.fn(async (query: string) => ({
    provider: 'tavily' as const, query, statusCode: 200, durationMs: 1,
    items: [{ url: 'https://reddit.com/r/markets/comments/public', title: 'Market communities', snippet: '',
      pageContent: 'https://discord.gg/broad https://discord.gg/exact https://discord.gg/game https://discord.gg/expired' }],
  }));
  const output = await new SearchOrchestrator({
    primaryProvider: { name: 'tavily', search, isAvailable: () => true, getDailyRequestCount: () => 0 },
    includeBroadMatches: true, timedMaxRequests: 1,
    verifyInviteFn: async (code) => ({
      ...invite(code, code === 'game' ? 'Welcome to our anime and gaming community' : code === 'broad'
        ? 'Welcome to our stock market discussion' : 'Welcome to our forex currency trading community'),
      status: code === 'expired' ? 'expired_or_revoked' : 'valid',
    }),
  }).executeJob({ topics: ['forex'], languages: ['en'], targetPlatforms: ['reddit'], limit: 10, depth: 5 });
  expect(search).toHaveBeenCalledTimes(1);
  expect(output.results.map(({ invite }) => invite.code)).toEqual(['exact', 'broad', 'expired']);
  expect(output.results.slice(0, 2).map(({ scoreBreakdown }) => scoreBreakdown.preferenceMatch)).toEqual([true, false]);
  expect(output.results[1].sources[0].sourceUrl).toBe('https://reddit.com/r/markets/comments/public');
});
