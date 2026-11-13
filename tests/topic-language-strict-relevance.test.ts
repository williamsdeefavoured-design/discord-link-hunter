import { describe, it, expect } from 'vitest';
import {
  calculateInviteScore,
  rankInviteResults,
  hasCredibleTopicEvidence,
  TradingTopic,
  LanguageCode,
  VerifiedInvite,
  DiscoveredInvite,
} from '../packages/core/src/index.js';
import { SearchOrchestrator } from '../packages/research/src/orchestrator.js';
import { MockSearchAdapter } from '../packages/research/src/mock.js';
import { QueryPlanner } from '../packages/research/src/query-planner.js';

function createInvite(opts: {
  code: string;
  name?: string;
  description?: string | null;
  approximateMemberCount?: number;
  sources?: DiscoveredInvite[];
}): { invite: VerifiedInvite; sources: DiscoveredInvite[] } {
  return {
    invite: {
      code: opts.code,
      canonicalUrl: `https://discord.gg/${opts.code}`,
      status: 'valid',
      community: {
        id: `id-${opts.code}`,
        name: opts.name ?? opts.code,
        description: opts.description ?? null,
        approximateMemberCount: opts.approximateMemberCount ?? 3000,
        approximatePresenceCount: 500,
      },
      lastVerifiedAt: new Date().toISOString(),
    },
    sources: opts.sources ?? [
      {
        rawUrl: `https://discord.gg/${opts.code}`,
        code: opts.code,
        canonicalUrl: `https://discord.gg/${opts.code}`,
        sourceUrl: `https://example.com/${opts.code}`,
        sourceDomain: 'example.com',
        provider: 'serper',
        discoveredAt: new Date().toISOString(),
      },
    ],
  };
}

describe('Final Search Relevance: Dual Topic & Language Filtering', () => {
  // TEST 1: Spanish XAUUSD excludes Spanish communities with no gold/XAUUSD relevance
  it('TEST 1: Spanish XAUUSD strictly excludes Spanish communities with zero gold/XAUUSD relevance', () => {
    const spanishForex = createInvite({
      code: 'es-forex-only',
      name: 'Comunidad Forex Latino',
      description: 'Aprende trading en el mercado de divisas y señales forex con traders profesionales.',
    });

    const spanishCrypto = createInvite({
      code: 'es-crypto-only',
      name: 'Crypto España & Bitcoin',
      description: 'Servidor para conversar sobre criptomonedas, bitcoin y altcoins en español.',
    });

    // Score checks: topic relevance must be 0 for xauusd
    const score1 = calculateInviteScore(spanishForex.invite, spanishForex.sources, ['xauusd'], ['es']);
    expect(score1.scoreBreakdown.topicRelevance).toBe(0);
    expect(score1.detectedLanguage).toBe('es');
    expect(score1.score).toBeLessThanOrEqual(35);

    const score2 = calculateInviteScore(spanishCrypto.invite, spanishCrypto.sources, ['xauusd'], ['es']);
    expect(score2.scoreBreakdown.topicRelevance).toBe(0);
    expect(score2.detectedLanguage).toBe('es');
    expect(score2.score).toBeLessThanOrEqual(35);

    // Ranking filter: must return 0 results
    const results = rankInviteResults([spanishForex, spanishCrypto], ['xauusd'], ['es']);
    expect(results.length).toBe(0);
  });

  // TEST 2: Portuguese Stocks excludes Portuguese communities with no stock-market relevance
  it('TEST 2: Portuguese Stocks strictly excludes Portuguese communities with zero stock relevance', () => {
    const portugueseForex = createInvite({
      code: 'pt-forex-only',
      name: 'Mercado Cambial Brasil',
      description: 'Sinais forex e mercado cambial para traders no Brasil.',
    });

    const portugueseCrypto = createInvite({
      code: 'pt-crypto-only',
      name: 'Criptomoedas Brasil DeFi',
      description: 'Discussão sobre bitcoin, criptomoedas e finanças descentralizadas.',
    });

    const score1 = calculateInviteScore(portugueseForex.invite, portugueseForex.sources, ['stocks'], ['pt']);
    expect(score1.scoreBreakdown.topicRelevance).toBe(0);
    expect(score1.detectedLanguage).toBe('pt');

    const score2 = calculateInviteScore(portugueseCrypto.invite, portugueseCrypto.sources, ['stocks'], ['pt']);
    expect(score2.scoreBreakdown.topicRelevance).toBe(0);
    expect(score2.detectedLanguage).toBe('pt');

    const results = rankInviteResults([portugueseForex, portugueseCrypto], ['stocks'], ['pt']);
    expect(results.length).toBe(0);
  });

  // TEST 3: German Stocks includes credible German stock communities
  it('TEST 3: German Stocks includes credible German stock communities and excludes non-stock German servers', () => {
    const germanStocks = createInvite({
      code: 'de-stocks-valid',
      name: 'Aktien & Börse Deutschland',
      description: 'Offizieller deutscher Börsen Server für Aktien, Wertpapiere und DAX Analysen.',
    });

    const germanForex = createInvite({
      code: 'de-forex-excluded',
      name: 'Devisenhandel Deutschland',
      description: 'Täglich kostenlose Marktanalysen und Devisenhandel Diskussion.',
    });

    const results = rankInviteResults([germanStocks, germanForex], ['stocks'], ['de']);
    expect(results.length).toBe(1);
    expect(results[0].invite.code).toBe('de-stocks-valid');
    expect(results[0].detectedLanguage).toBe('de');
    expect(results[0].scoreBreakdown.topicRelevance).toBeGreaterThanOrEqual(20);
    expect(results[0].score).toBeGreaterThanOrEqual(80);
  });

  // TEST 4: All six languages verified with fixtures
  it('TEST 4: Accurately validates both topic and language across all six supported languages', () => {
    const fixtures: Array<{
      lang: LanguageCode;
      topic: TradingTopic;
      valid: { code: string; name: string; description: string };
      wrongTopic: { code: string; name: string; description: string };
    }> = [
      {
        lang: 'en',
        topic: 'stocks',
        valid: {
          code: 'en-stocks',
          name: 'Equity Traders Club',
          description: 'Official community for stock trading, equities, shares, and pre-market earnings reports.',
        },
        wrongTopic: {
          code: 'en-forex',
          name: 'Global Currency Chat',
          description: 'Forex signals and currency trading only.',
        },
      },
      {
        lang: 'de',
        topic: 'stocks',
        valid: {
          code: 'de-stocks',
          name: 'Aktienhandel Deutschland',
          description: 'Deutscher Server für Aktien, Wertpapiere und Börse.',
        },
        wrongTopic: {
          code: 'de-crypto',
          name: 'Krypto Deutschland',
          description: 'Bitcoin und Kryptowährung Diskussion.',
        },
      },
      {
        lang: 'es',
        topic: 'xauusd',
        valid: {
          code: 'es-gold',
          name: 'Comunidad Trading de Oro',
          description: 'Análisis de oro, señales oro y trading de xauusd en español.',
        },
        wrongTopic: {
          code: 'es-stocks',
          name: 'Bolsa de Valores España',
          description: 'Inversión en acciones y renta variable en la bolsa.',
        },
      },
      {
        lang: 'pt',
        topic: 'stocks',
        valid: {
          code: 'pt-stocks',
          name: 'Clube de Ações e B3 Brasil',
          description: 'Comunidade focada em ações da B3, dividendos e mercado de capitais no Brasil.',
        },
        wrongTopic: {
          code: 'pt-forex',
          name: 'Mercado Cambial Brasil',
          description: 'Sinais forex e mercado cambial.',
        },
      },
      {
        lang: 'fr',
        topic: 'forex',
        valid: {
          code: 'fr-forex',
          name: 'Marché des Changes France',
          description: 'Signaux forex et trading de devises sur le marché des changes en France.',
        },
        wrongTopic: {
          code: 'fr-crypto',
          name: 'Crypto France Pro',
          description: 'Communauté crypto et bitcoin en France.',
        },
      },
      {
        lang: 'ar',
        topic: 'xauusd',
        valid: {
          code: 'ar-gold',
          name: 'متداولو الذهب والعملات العرب',
          description: 'سيرفر ديسكورد لتداول الذهب وتحليل الذهب اليومي مع نخبة من المحللين.',
        },
        wrongTopic: {
          code: 'ar-stocks',
          name: 'سوق الأسهم السعودي',
          description: 'تداول الأسهم والبورصة فقط.',
        },
      },
    ];

    for (const f of fixtures) {
      const validItem = createInvite(f.valid);
      const wrongTopicItem = createInvite(f.wrongTopic);

      const filtered = rankInviteResults([validItem, wrongTopicItem], [f.topic], [f.lang]);
      expect(filtered.length).toBe(1);
      expect(filtered[0].invite.code).toBe(f.valid.code);
      expect(filtered[0].detectedLanguage).toBe(f.lang);
      expect(hasCredibleTopicEvidence(filtered[0], [f.topic])).toBe(true);
    }
  });

  // TEST 5: Communities with missing descriptions
  it('TEST 5: Evaluates communities with missing descriptions accurately', () => {
    // Case A: Community name has explicit topic keyword (e.g. Gold & XAUUSD Scalpers)
    const missingDescValid = createInvite({
      code: 'gold-missing-desc',
      name: 'Gold & XAUUSD Scalpers Official Community',
      description: null, // Discord did not provide description
    });

    const resA = rankInviteResults([missingDescValid], ['xauusd'], ['en']);
    expect(resA.length).toBe(1);
    expect(resA[0].invite.code).toBe('gold-missing-desc');
    expect(resA[0].scoreBreakdown.topicRelevance).toBeGreaterThanOrEqual(20);

    // Case B: Community name has NO topic keywords and description is missing
    const missingDescIrrelevant = createInvite({
      code: 'generic-missing-desc',
      name: 'Spanish Community Chat',
      description: null,
    });

    const resB = rankInviteResults([missingDescIrrelevant], ['xauusd'], ['es']);
    expect(resB.length).toBe(0);
  });

  // TEST 6: Communities with misleading source snippets
  it('TEST 6: Rejects communities with misleading source snippets that do not match server metadata', () => {
    const misleadingGaming = createInvite({
      code: 'anime-gaming-hub',
      name: 'Anime & Gaming España',
      description: 'Servidor de Minecraft, anime y charla casual con amigos.',
      sources: [
        {
          rawUrl: 'https://discord.gg/anime-gaming-hub',
          code: 'anime-gaming-hub',
          canonicalUrl: 'https://discord.gg/anime-gaming-hub',
          sourceUrl: 'https://directory.com/servers',
          sourceDomain: 'directory.com',
          provider: 'serper',
          discoveredAt: new Date().toISOString(),
          contextSnippet: 'Search results for xauusd gold trading: check out discord.gg/anime-gaming-hub',
        },
      ],
    });

    const score = calculateInviteScore(misleadingGaming.invite, misleadingGaming.sources, ['xauusd'], ['es']);
    expect(score.scoreBreakdown.topicRelevance).toBe(0);
    expect(score.scoreBreakdown.explanations.some((e) => e.includes('non-trading'))).toBe(true);

    const filtered = rankInviteResults([misleadingGaming], ['xauusd'], ['es']);
    expect(filtered.length).toBe(0);
  });

  // TEST 7: Confirm Mock and Live search orchestration pipelines function properly
  it('TEST 7: Orchestrator generates correct relevanceFilterNotice when communities are excluded', async () => {
    const mockPrimary = new MockSearchAdapter();
    const orchestrator = new SearchOrchestrator({
      primaryProvider: mockPrimary,
      queryPlanner: new QueryPlanner(5),
      maxConcurrent: 2,
      verifyInviteFn: async (code) => {
        // Return a valid Spanish forex server
        return {
          code,
          canonicalUrl: `https://discord.gg/${code}`,
          status: 'valid',
          community: {
            id: 'id-1',
            name: 'Forex Español Club',
            description: 'Comunidad forex y mercado de divisas en español.',
            approximateMemberCount: 4000,
            approximatePresenceCount: 500,
          },
          lastVerifiedAt: new Date().toISOString(),
        };
      },
      isSimulated: true,
    });

    // Request xauusd in Spanish
    const outcome = await orchestrator.executeJob({
      topics: ['xauusd'],
      languages: ['es'],
      limit: 10,
      depth: 1,
    });

    // Since the verified community is forex (not gold/xauusd), it must be excluded!
    expect(outcome.results.length).toBe(0);
    expect(outcome.languageFilterNotice).toBeDefined();
    expect(outcome.languageFilterNotice).toContain('Strict relevance filter active');
    expect(outcome.languageFilterNotice).toContain('Topic: XAUUSD');
    expect(outcome.languageFilterNotice).toContain('Lang: ES');
    expect(outcome.progress.languageFilteredOutCount).toBeGreaterThan(0);
  });
});
