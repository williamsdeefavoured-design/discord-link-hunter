import { ProviderSearchResult, SearchProvider, SearchProviderOptions } from './types.js';

export const MOCK_FIXTURES: Record<string, { title: string; url: string; snippet: string }[]> = {
  forex: [
    {
      title: 'r/Forex Discord Trading Group - Join Us',
      url: 'https://reddit.com/r/Forex/comments/abc123/official_discord',
      snippet:
        'Join our daily Forex scalping discussion on Discord: https://discord.gg/fx-reddit-lounge with 14,000 members.',
    },
    {
      title: 'EURUSD Scalping Strategy + PineScript - TradingView',
      url: 'https://tradingview.com/chart/EURUSD/123-scalping',
      snippet:
        'Published ideas and community chat. Discord invite: https://discord.gg/tv-scalpers with 18,500 traders.',
    },
    {
      title: 'TradingView PineScript Community on Reddit',
      url: 'https://reddit.com/r/TradingView/comments/pine_chat',
      snippet:
        'Discussing TradingView scripts in our Discord server: https://discord.gg/tv-scalpers with active coders.',
    },
    {
      title: 'Forex Macro Alpha Weekly - Substack',
      url: 'https://marketmacro.substack.com/p/welcome-to-our-community',
      snippet:
        'Weekly currency pairs analysis. Join our community chat: https://discord.gg/substack-macro for daily charts.',
    },
    {
      title: 'Forex Signals VIP Community - Patreon',
      url: 'https://patreon.com/forexsignalsvip',
      snippet:
        'Join our member discord for daily forex trades: https://discord.gg/patreon-traders with trade alerts.',
    },
    {
      title: 'Day Trading Desk on X: Live FX stream',
      url: 'https://x.com/DayTradingDesk/status/1234567890',
      snippet:
        'Sharing setups for London open. Discord community: https://discord.gg/x-trading-desk with live trade floor.',
    },
    {
      title: 'Top Forex Trading Communities in 2024 - Medium',
      url: 'https://medium.com/@fxwriter/top-forex-discord-communities-2024',
      snippet:
        'A curated list of currency trading groups. Check out https://discord.gg/fx-elite-club with over 4,500 active traders.',
    },
    {
      title: 'What is the best Discord server for learning forex? - Quora',
      url: 'https://quora.com/What-is-the-best-Discord-server-for-learning-forex',
      snippet:
        'I recommend the German Devisen community https://discord.gg/devisen-trader for structured education.',
    },
    {
      title: '$EURUSD Stream - Stocktwits',
      url: 'https://stocktwits.com/r/FuturesRoom',
      snippet:
        'Live futures and forex levels. Chat with us on Discord: https://discord.gg/stocktwits-futures for morning prep.',
    },
    {
      title: 'Daily FX Pulse Blog - Community Room',
      url: 'https://dailyfxpulse.wordpress.com/join-our-chat',
      snippet:
        'Our official blog reader discord: https://discord.gg/wp-forex-traders with daily technical market wrap-ups.',
    },
    {
      title: 'Live Scalpers Thread - ForexFactory',
      url: 'https://forexfactory.com/thread/998877-live-trading-room',
      snippet:
        'Real-time scalping signals and chart sharing on Discord: https://discord.gg/ff-scalping-crew with active members.',
    },
    {
      title: 'Where can I find a good Forex day trading community? - Reddit',
      url: 'https://reddit.com/r/Forex/comments/no_invite_thread',
      snippet:
        'Looking for an active Forex trading Discord group with live voice chat and mentorship for beginner scalpers.',
    },
    {
      title: 'Old Forex Signals Archive - Substack',
      url: 'https://oldarchive.substack.com/p/expired-post',
      snippet:
        'Archived newsletter post with old invite: https://discord.gg/expired-community-link that is no longer active.',
    },
    {
      title: 'Comunidad Forex en Español - Reddit',
      url: 'https://reddit.com/r/spain_trading/comments/1_forex',
      snippet:
        'Aprende trading de divisas y scalping en nuestro servidor de Discord https://discord.gg/forex-hispano con traders profesionales.',
    },
    {
      title: 'Devisenhandel & FX Signale Deutschland - Foren',
      url: 'https://forexfactory.com/thread/devisen_deutschland',
      snippet:
        'Offizieller deutscher Forex Discord Server. Täglich kostenlose Marktanalysen und Devisenhandel: https://discord.gg/devisen-trader',
    },
  ],
  xauusd: [
    {
      title: 'Gold & XAUUSD Daily Price Action Signals',
      url: 'https://goldtradershub.com/invite',
      snippet:
        'Live New York and London session gold scalping. Join our Discord community here: https://discord.gg/gold-scalpers-vip with 8,200 members.',
    },
    {
      title: 'تداول الذهب والعملات - مجتمع المتداولين العرب على Substack',
      url: 'https://arab-traders.substack.com/p/gold-discord',
      snippet:
        'أفضل سيرفر ديسكورد لتداول الذهب والتحليل الفني اليومي: https://discord.gg/arab-gold-traders مع نخبة من المحللين.',
    },
    {
      title: 'Gold Scalping Discussions - Reddit',
      url: 'https://reddit.com/r/GoldTrading/comments/xau_chat',
      snippet:
        'Live scalping gold during CPI and FOMC. Join our Discord: https://discord.gg/gold-scalpers-vip with 8,200 members.',
    },
  ],
  crypto: [
    {
      title: 'Crypto Alpha & DeFi Education Hub',
      url: 'https://cryptowatch.io/communities/alpha',
      snippet:
        'Bitcoin, Ethereum, and on-chain analysis. Join the discussion on Discord: https://discord.gg/crypto-alpha-hub with daily webinars.',
    },
    {
      title: 'Trading Crypto & Bourse France - Medium',
      url: 'https://medium.com/@francecrypto/communaute-trading-discord',
      snippet:
        'Rejoignez la plus grande communauté crypto et trading en France. Invitation Discord : https://discord.gg/crypto-france-pro',
    },
  ],
  stocks: [
    {
      title: 'Equity Traders & Market Open Discord',
      url: 'https://stocktalk.org/chat',
      snippet:
        'Pre-market watchlist, earnings reports, and options flow. Discord invite: https://discord.gg/equity-traders-pro with 12,000 members.',
    },
    {
      title: 'Clube de Ações e B3 Brasil - Reddit',
      url: 'https://reddit.com/r/investimentos/comments/b3_discord',
      snippet:
        'Comunidade focada em ações da B3 e dividendos no Brasil. Entre no nosso Discord https://discord.gg/acoes-brasil-traders',
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
    const limit = options.limit || 15;

    const lower = query.toLowerCase();
    const candidatePool: { title: string; url: string; snippet: string }[] = [];

    // Gather candidate items matching topics
    for (const [key, items] of Object.entries(MOCK_FIXTURES)) {
      if (lower.includes(key) || lower.includes(key.replace('_', ' '))) {
        candidatePool.push(...items);
      }
    }

    if (candidatePool.length === 0) {
      candidatePool.push(...MOCK_FIXTURES.forex, ...MOCK_FIXTURES.xauusd);
    }

    // If query has site: operator or platform name, prioritize matching items
    let filteredItems: { title: string; url: string; snippet: string }[] = [];

    const platforms = [
      { key: 'reddit', domain: 'reddit.com' },
      { key: 'tradingview', domain: 'tradingview.com' },
      { key: 'substack', domain: 'substack.com' },
      { key: 'patreon', domain: 'patreon.com' },
      { key: 'twitter', domain: 'x.com' },
      { key: 'x.com', domain: 'x.com' },
      { key: 'medium', domain: 'medium.com' },
      { key: 'quora', domain: 'quora.com' },
      { key: 'stocktwits', domain: 'stocktwits.com' },
      { key: 'wordpress', domain: 'wordpress.com' },
      { key: 'forexfactory', domain: 'forexfactory.com' },
    ];

    const matchedPlatform = platforms.find((p) => lower.includes(p.key) || lower.includes(p.domain));

    if (matchedPlatform) {
      filteredItems = candidatePool.filter(
        (item) => item.url.includes(matchedPlatform.domain) || item.title.toLowerCase().includes(matchedPlatform.key)
      );
    }

    if (filteredItems.length === 0) {
      filteredItems = candidatePool;
    }

    const items = filteredItems.slice(0, limit);

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
