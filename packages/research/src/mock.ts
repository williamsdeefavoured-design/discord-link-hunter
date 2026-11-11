import { ProviderSearchResult, SearchProvider, SearchProviderOptions } from './types.js';

export const MOCK_FIXTURES: Record<string, { title: string; url: string; snippet: string }[]> = {
  forex: [
    {
      title: 'Global Forex Traders Club - Discord Community',
      url: 'https://tradingdirectory.org/forex-traders-club',
      snippet: 'Join the premier FX trading community for live analysis and trade ideas. Discord invite: https://discord.gg/fx-elite-club with over 4,500 active traders.',
    },
    {
      title: 'Devisenhandel & FX Signale Deutschland',
      url: 'https://boerse-community.de/forex-discord',
      snippet: 'Offizieller deutscher Forex Discord Server. Täglich kostenlose Marktanalysen und Devisenhandel Diskussion. Link: https://discord.gg/devisen-trader',
    },
    {
      title: 'Comunidad Forex en Español - Señales y Educación',
      url: 'https://forexlatam.net/comunidad',
      snippet: 'Aprende trading de divisas y scalping en nuestro servidor de Discord https://discord.gg/forex-hispano con traders profesionales.',
    },
  ],
  xauusd: [
    {
      title: 'Gold & XAUUSD Daily Price Action Signals',
      url: 'https://goldtradershub.com/invite',
      snippet: 'Live New York and London session gold scalping. Join our Discord community here: https://discord.gg/gold-scalpers-vip with 8,200 members.',
    },
    {
      title: 'تداول الذهب والعملات - مجتمع المتداولين العرب',
      url: 'https://arab-traders.com/gold-discord',
      snippet: 'أفضل سيرفر ديسكورد لتداول الذهب والتحليل الفني اليومي: https://discord.gg/arab-gold-traders مع نخبة من المحللين.',
    },
  ],
  crypto: [
    {
      title: 'Crypto Alpha & DeFi Education Hub',
      url: 'https://cryptowatch.io/communities/alpha',
      snippet: 'Bitcoin, Ethereum, and on-chain analysis. Join the discussion on Discord: https://discord.gg/crypto-alpha-hub with daily webinars.',
    },
    {
      title: 'Trading Crypto & Bourse France',
      url: 'https://cryptofrance.fr/discord',
      snippet: 'Rejoignez la plus grande communauté crypto et trading en France. Invitation Discord : https://discord.gg/crypto-france-pro',
    },
  ],
  stocks: [
    {
      title: 'Equity Traders & Market Open Discord',
      url: 'https://stocktalk.org/chat',
      snippet: 'Pre-market watchlist, earnings reports, and options flow. Discord invite: https://discord.gg/equity-traders-pro with 12,000 members.',
    },
    {
      title: 'Clube de Ações e B3 Brasil - Discord',
      url: 'https://b3traders.com.br/comunidade',
      snippet: 'Comunidade focada em ações da B3 e dividendos no Brasil. Entre no nosso Discord https://discord.gg/acoes-brasil-traders',
    },
  ],
};

export class MockSearchAdapter implements SearchProvider {
  name: 'mock' = 'mock';
  private requestCount = 0;

  isAvailable(): boolean {
    return true;
  }

  getDailyRequestCount(): number {
    return this.requestCount;
  }

  async search(query: string, options: SearchProviderOptions = {}): Promise<ProviderSearchResult> {
    this.requestCount++;
    const start = Date.now();
    const limit = options.limit || 10;

    const lower = query.toLowerCase();
    let matchingItems: { title: string; url: string; snippet: string }[] = [];

    for (const [key, items] of Object.entries(MOCK_FIXTURES)) {
      if (lower.includes(key) || lower.includes(key.replace('_', ' '))) {
        matchingItems.push(...items);
      }
    }

    if (matchingItems.length === 0) {
      // Default to forex + xauusd fixtures
      matchingItems = [...MOCK_FIXTURES.forex, ...MOCK_FIXTURES.xauusd];
    }

    const items = matchingItems.slice(0, limit);

    return {
      provider: 'mock',
      query,
      items,
      creditCost: 0,
      statusCode: 200,
      durationMs: Date.now() - start,
    };
  }
}

