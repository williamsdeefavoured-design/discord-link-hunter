import { ResearchSourceConfig, SourceCategory } from './types.js';

export const DEFAULT_RESEARCH_SOURCES: ResearchSourceConfig[] = [
  {
    id: 'reddit',
    name: 'Reddit',
    category: 'discussion_forum',
    domains: ['reddit.com', 'redd.it'],
    accessMethod: 'public_search',
    enabled: true,
    searchOperatorTemplate: 'site:reddit.com',
    notes:
      'Indexed public discussion discovery via search provider. Direct Reddit OAuth API requires developer app registration and commercial data agreements.',
  },
  {
    id: 'x_twitter',
    name: 'X (Twitter)',
    category: 'social_network',
    domains: ['twitter.com', 'x.com', 't.co'],
    accessMethod: 'public_search',
    enabled: true,
    searchOperatorTemplate: '(site:x.com OR site:twitter.com)',
    notes:
      'Public post discovery via search. Direct Twitter API v2 Basic tier costs $100/mo and Pro costs $5,000/mo.',
  },
  {
    id: 'substack',
    name: 'Substack',
    category: 'newsletter_publishing',
    domains: ['substack.com'],
    accessMethod: 'public_search',
    enabled: true,
    searchOperatorTemplate: 'site:substack.com',
    notes:
      'Public newsletter and creator community discovery via search. No public full-text community search API.',
  },
  {
    id: 'patreon',
    name: 'Patreon',
    category: 'creator_platform',
    domains: ['patreon.com'],
    accessMethod: 'public_search',
    enabled: true,
    searchOperatorTemplate: 'site:patreon.com',
    notes:
      'Public creator landing pages and tier descriptions. Direct API v2 is member/creator-scoped OAuth only.',
  },
  {
    id: 'medium',
    name: 'Medium',
    category: 'publishing_platform',
    domains: ['medium.com'],
    accessMethod: 'public_search',
    enabled: true,
    searchOperatorTemplate: 'site:medium.com',
    notes: 'Public trading publications, stories, and author profiles.',
  },
  {
    id: 'quora',
    name: 'Quora',
    category: 'q_and_a',
    domains: ['quora.com'],
    accessMethod: 'public_search',
    enabled: true,
    searchOperatorTemplate: 'site:quora.com',
    notes: 'Public trading Q&A questions, answers, and space posts.',
  },
  {
    id: 'tradingview',
    name: 'TradingView',
    category: 'charting_community',
    domains: ['tradingview.com'],
    accessMethod: 'public_search',
    enabled: true,
    searchOperatorTemplate: 'site:tradingview.com',
    notes: 'Public published ideas, technical analysis scripts, and trader profile links.',
  },
  {
    id: 'stocktwits',
    name: 'Stocktwits',
    category: 'microblogging',
    domains: ['stocktwits.com'],
    accessMethod: 'public_search',
    enabled: true,
    searchOperatorTemplate: 'site:stocktwits.com',
    notes: 'Public ticker stream discussions, sentiment streams, and trader room links.',
  },
  {
    id: 'trading_blogs',
    name: 'Trading Blogs (WordPress/Ghost)',
    category: 'trading_blogs',
    domains: ['wordpress.com', 'ghost.io', 'blogspot.com'],
    accessMethod: 'public_search',
    enabled: true,
    searchOperatorTemplate: '(site:wordpress.com OR site:ghost.io OR site:blogspot.com)',
    notes: 'Independent public trading blogs and market analysis publications.',
  },
  {
    id: 'trading_forums',
    name: 'Trading Forums',
    category: 'trading_forums',
    domains: ['forexfactory.com', 'babypips.com', 'elitetrader.com', 'trade2win.com', 'myfxbook.com'],
    accessMethod: 'public_search',
    enabled: true,
    searchOperatorTemplate: '(site:forexfactory.com OR site:babypips.com OR site:elitetrader.com OR site:trade2win.com)',
    notes: 'Dedicated public forex, futures, and equity trading forums.',
  },
];

export class SourceRegistry {
  private sources: Map<string, ResearchSourceConfig> = new Map();

  constructor(initialSources: ResearchSourceConfig[] = DEFAULT_RESEARCH_SOURCES) {
    for (const src of initialSources) {
      this.sources.set(src.id, { ...src });
    }
  }

  getAllSources(): ResearchSourceConfig[] {
    return Array.from(this.sources.values());
  }

  getSource(id: string): ResearchSourceConfig | undefined {
    return this.sources.get(id);
  }

  registerSource(source: ResearchSourceConfig): void {
    this.sources.set(source.id, { ...source });
  }

  getActiveSources(filterIds?: string[]): ResearchSourceConfig[] {
    const all = Array.from(this.sources.values()).filter((s) => s.enabled);
    if (!filterIds || filterIds.length === 0) {
      return all;
    }
    const idSet = new Set(filterIds.map((id) => id.toLowerCase()));
    return all.filter((s) => idSet.has(s.id.toLowerCase()));
  }

  identifySource(urlOrDomain: string): ResearchSourceConfig | undefined {
    if (!urlOrDomain) return undefined;

    let host = urlOrDomain.trim().toLowerCase();
    try {
      if (host.includes('://')) {
        host = new URL(host).hostname.toLowerCase();
      } else if (host.includes('/')) {
        host = host.split('/')[0].toLowerCase();
      }
    } catch {
      // Keep host as trimmed string
    }

    // Strip leading www.
    host = host.replace(/^www\./, '');

    for (const source of this.sources.values()) {
      for (const domain of source.domains) {
        const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
        if (host === cleanDomain || host.endsWith(`.${cleanDomain}`)) {
          return source;
        }
      }
    }

    return undefined;
  }

  buildQuery(sourceId: string, keyword: string, suffix = '"discord.gg/"'): string | null {
    const source = this.sources.get(sourceId);
    if (!source || !source.enabled) return null;
    return `${source.searchOperatorTemplate} ${keyword} ${suffix}`.trim();
  }
}

// Global default singleton
let _defaultRegistry: SourceRegistry | null = null;

export function getDefaultSourceRegistry(): SourceRegistry {
  if (!_defaultRegistry) {
    _defaultRegistry = new SourceRegistry();
  }
  return _defaultRegistry;
}

export function identifySourcePlatform(urlOrDomain: string): ResearchSourceConfig | undefined {
  return getDefaultSourceRegistry().identifySource(urlOrDomain);
}

export function getSourceConfig(id: string): ResearchSourceConfig | undefined {
  return getDefaultSourceRegistry().getSource(id);
}

