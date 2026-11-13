import { DiscoveredInvite, InviteStatus, VerifiedInvite } from './types.js';
import { identifySourcePlatform } from './sources.js';

// Regex patterns for matching Discord invitations
// Match discord.gg/CODE, discord.com/invite/CODE, discordapp.com/invite/CODE
const DISCORD_INVITE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([a-zA-Z0-9-]{2,32})/gi;

export function extractDiscordInviteCode(inputUrl: string): string | null {
  if (!inputUrl) return null;
  const match = DISCORD_INVITE_REGEX.exec(inputUrl);
  DISCORD_INVITE_REGEX.lastIndex = 0; // Reset regex state
  if (match && match[1]) {
    // Strip trailing punctuation often found in text (.,;:!?)
    return match[1].replace(/[.,;:!?]+$/, '');
  }
  return null;
}

export function canonicalizeDiscordInvite(codeOrUrl: string): { code: string; canonicalUrl: string } | null {
  const code = extractDiscordInviteCode(codeOrUrl) || (codeOrUrl.match(/^[a-zA-Z0-9-]{2,32}$/) ? codeOrUrl : null);
  if (!code) return null;
  return {
    code,
    canonicalUrl: `https://discord.gg/${code}`,
  };
}

export function extractDiscordInvites(
  text: string,
  sourceUrl = '',
  provider: 'serper' | 'tavily' | 'mock' | 'manual' = 'manual'
): DiscoveredInvite[] {
  if (!text) return [];

  const found: DiscoveredInvite[] = [];
  const seenCodes = new Set<string>();

  let domain = '';
  if (sourceUrl) {
    try {
      domain = new URL(sourceUrl).hostname;
    } catch {
      // ignore
    }
  }

  const platformConfig = sourceUrl ? identifySourcePlatform(domain || sourceUrl) : undefined;
  const sourcePlatform = platformConfig ? platformConfig.id : domain ? 'general_web' : undefined;
  const sourcePlatformName = platformConfig ? platformConfig.name : domain || undefined;
  const sourceCategory = platformConfig ? platformConfig.category : domain ? 'general_web' : undefined;

  const matches = text.matchAll(DISCORD_INVITE_REGEX);
  for (const match of matches) {
    const rawUrl = match[0];
    const rawCode = match[1]?.replace(/[.,;:!?]+$/, '');
    if (!rawCode || seenCodes.has(rawCode)) continue;

    seenCodes.add(rawCode);

    // Extract surrounding context snippet (up to 120 chars)
    const matchIndex = match.index ?? 0;
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(text.length, matchIndex + rawUrl.length + 50);
    const contextSnippet = text.slice(start, end).replace(/\s+/g, ' ').trim();

    found.push({
      rawUrl,
      code: rawCode,
      canonicalUrl: `https://discord.gg/${rawCode}`,
      sourceUrl: sourceUrl || undefined,
      sourceDomain: domain || undefined,
      sourcePlatform,
      sourcePlatformName,
      sourceCategory,
      provider,
      discoveredAt: new Date().toISOString(),
      contextSnippet,
    });
  }

  return found;
}

// SSRF Safe URL Check
export function isSafeUrl(urlString: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Blocked protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    return { safe: false, reason: 'Blocked local host/address' };
  }

  // IPv4 private/reserved ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets.some((o) => o < 0 || o > 255)) {
      return { safe: false, reason: 'Invalid IP address' };
    }
    const [o1, o2] = octets;

    // 127.0.0.0/8 loopback
    if (o1 === 127) return { safe: false, reason: 'Loopback IP' };
    // 10.0.0.0/8 private
    if (o1 === 10) return { safe: false, reason: 'Private IP 10.x.x.x' };
    // 172.16.0.0/12 private (172.16.0.0 – 172.31.255.255)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return { safe: false, reason: 'Private IP 172.16-31.x.x' };
    // 192.168.0.0/16 private
    if (o1 === 192 && o2 === 168) return { safe: false, reason: 'Private IP 192.168.x.x' };
    // 169.254.0.0/16 link-local & cloud metadata
    if (o1 === 169 && o2 === 254) return { safe: false, reason: 'Link-local/metadata IP' };
    // 0.0.0.0/8 or 255.255.255.255 broadcast
    if (o1 === 0 || o1 === 255) return { safe: false, reason: 'Broadcast/unspecified IP' };
  }

  return { safe: true };
}

// Discord Invite verification against public API
export async function verifyDiscordInvite(
  code: string,
  fetchFn: typeof fetch = fetch
): Promise<VerifiedInvite> {
  const canonicalUrl = `https://discord.gg/${code}`;
  const now = new Date().toISOString();

  const apiUrl = `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true&with_expiration=true`;

  try {
    const res = await fetchFn(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'DiscordLinkHunter/2.1 (https://github.com/discord-link-hunter)',
        Accept: 'application/json',
      },
    });

    const httpStatus = res.status;

    if (res.status === 200) {
      const data = (await res.json()) as any;
      const guild = data.guild;

      return {
        code,
        canonicalUrl,
        status: 'valid',
        statusReason: 'Discord invite confirmed active and valid',
        community: guild
          ? {
              id: guild.id,
              name: guild.name,
              description: guild.description ?? null,
              approximateMemberCount: data.approximate_member_count ?? null,
              approximatePresenceCount: data.approximate_presence_count ?? null,
              icon: guild.icon ?? null,
              banner: guild.banner ?? null,
              splash: guild.splash ?? null,
              verificationLevel: guild.verification_level,
              features: guild.features ?? [],
              vanityUrlCode: guild.vanity_url_code ?? null,
            }
          : null,
        channelId: data.channel?.id ?? null,
        channelName: data.channel?.name ?? null,
        inviterUsername: data.inviter?.username ?? null,
        expiresAt: data.expires_at ?? null,
        lastVerifiedAt: now,
        httpStatus,
      };
    }

    if (res.status === 404) {
      const data = (await res.json().catch(() => ({}))) as any;
      return {
        code,
        canonicalUrl,
        status: 'expired_or_revoked',
        statusReason: data.message || 'Invite does not exist or has expired',
        lastVerifiedAt: now,
        httpStatus,
      };
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      return {
        code,
        canonicalUrl,
        status: 'rate_limited',
        statusReason: `Discord API rate limited. Retry after ${retryAfter ?? 'a few'} seconds`,
        lastVerifiedAt: now,
        httpStatus,
      };
    }

    // 400 or other 4xx/5xx
    return {
      code,
      canonicalUrl,
      status: 'unavailable',
      statusReason: `Discord API returned HTTP ${res.status}`,
      lastVerifiedAt: now,
      httpStatus,
    };
  } catch (err: any) {
    // Network or fetch error: NEVER classify as invalid!
    return {
      code,
      canonicalUrl,
      status: 'unknown',
      statusReason: `Network error verifying invite: ${err.message || 'fetch failed'}`,
      lastVerifiedAt: now,
    };
  }
}

// Deterministic simulated invites for Mock Mode
const MOCK_COMMUNITIES: Record<
  string,
  {
    status?: InviteStatus;
    statusReason?: string;
    channelName?: string;
    name?: string;
    description?: string;
    approximateMemberCount?: number;
    approximatePresenceCount?: number;
    features?: string[];
    vanityUrlCode?: string | null;
  }
> = {
  'fx-elite-club': {
    status: 'valid',
    statusReason: 'Simulated active Forex community',
    name: 'Global Forex Traders Club',
    description: 'Live forex market analysis, webinars, and educational signals.',
    approximateMemberCount: 4520,
    approximatePresenceCount: 680,
    features: ['COMMUNITY', 'NEWS'],
    vanityUrlCode: 'fx-elite-club',
    channelName: 'announcements',
  },
  'gold-scalpers-vip': {
    status: 'valid',
    statusReason: 'Simulated active Gold scalping community',
    name: 'Gold & XAUUSD Scalpers',
    description: 'Dedicated to Gold/XAUUSD price action and intraday trading.',
    approximateMemberCount: 8200,
    approximatePresenceCount: 1450,
    features: ['COMMUNITY', 'WELCOME_SCREEN_ENABLED'],
    vanityUrlCode: 'gold-scalpers-vip',
    channelName: 'live-charts',
  },
  'devisen-trader': {
    status: 'valid',
    statusReason: 'Simulated German Forex trading server',
    name: 'Devisenhandel & FX Signale Deutschland',
    description: 'Offizieller deutscher Forex Discord Server für Devisenhandel.',
    approximateMemberCount: 2950,
    approximatePresenceCount: 410,
    features: ['COMMUNITY'],
    channelName: 'allgemein',
  },
  'forex-hispano': {
    status: 'valid',
    statusReason: 'Simulated Spanish Forex community',
    name: 'Comunidad Forex en Español',
    description: 'Aprende trading de divisas y scalping con traders profesionales.',
    approximateMemberCount: 3800,
    approximatePresenceCount: 520,
    features: ['COMMUNITY'],
    channelName: 'sala-trading',
  },
  'arab-gold-traders': {
    status: 'valid',
    statusReason: 'Simulated Arabic Gold trading community',
    name: 'متداولو الذهب والعملات العرب',
    description: 'مجتمع تعليمي مجاني للتحليل الفني وتداول الذهب.',
    approximateMemberCount: 3100,
    approximatePresenceCount: 420,
    features: ['COMMUNITY'],
    channelName: 'توصيات-وتحليلات',
  },
  'crypto-alpha-hub': {
    status: 'valid',
    statusReason: 'Simulated Crypto Alpha & DeFi community',
    name: 'Crypto Alpha & DeFi Hub',
    description: 'On-chain intelligence, token metrics, and DeFi strategies.',
    approximateMemberCount: 9600,
    approximatePresenceCount: 2100,
    features: ['COMMUNITY', 'DISCOVERABLE'],
    vanityUrlCode: 'crypto-alpha-hub',
    channelName: 'alpha-signals',
  },
  'crypto-france-pro': {
    status: 'valid',
    statusReason: 'Simulated French Crypto community',
    name: 'Trading Crypto & Bourse France',
    description: 'Première communauté française sur les cryptomonnaies et les marchés financiers.',
    approximateMemberCount: 5120,
    approximatePresenceCount: 890,
    features: ['COMMUNITY'],
    channelName: 'general',
  },
  'equity-traders-pro': {
    status: 'valid',
    statusReason: 'Simulated Equity & Options trading community',
    name: 'Equity Traders & Market Open',
    description: 'Pre-market watchlist, options flow, and institutional earnings analysis.',
    approximateMemberCount: 12400,
    approximatePresenceCount: 3300,
    features: ['COMMUNITY', 'DISCOVERABLE', 'INVITE_SPLASH'],
    vanityUrlCode: 'equity-traders-pro',
    channelName: 'market-chatter',
  },
  'acoes-brasil-traders': {
    status: 'valid',
    statusReason: 'Simulated Brazilian Stock trading community',
    name: 'Clube de Ações e B3 Brasil',
    description: 'Análise de ações, dividendos e swing trade na bolsa brasileira.',
    approximateMemberCount: 4100,
    approximatePresenceCount: 630,
    features: ['COMMUNITY'],
    channelName: 'acoes-ibov',
  },
  'fx-reddit-lounge': {
    status: 'valid',
    statusReason: 'Simulated Reddit r/Forex community',
    name: 'Reddit Forex Lounge',
    description: 'The official trading discussion lounge from r/Forex with daily market recaps.',
    approximateMemberCount: 14200,
    approximatePresenceCount: 2200,
    features: ['COMMUNITY'],
    channelName: 'daily-discussion',
  },
  'tv-scalpers': {
    status: 'valid',
    statusReason: 'Simulated TradingView community',
    name: 'TradingView PineScript & Scalpers',
    description: 'Forex technical analysis ideas, Pine script indicators, and scalping setup signals.',
    approximateMemberCount: 18500,
    approximatePresenceCount: 3100,
    features: ['COMMUNITY', 'DISCOVERABLE'],
    channelName: 'pine-scripts',
  },
  'substack-macro': {
    status: 'valid',
    statusReason: 'Simulated Substack newsletter community',
    name: 'Macro Alpha & Gold Newsletter Community',
    description: 'Substack macroeconomic research, bond yields, and gold trading setups.',
    approximateMemberCount: 3200,
    approximatePresenceCount: 450,
    features: ['COMMUNITY'],
    channelName: 'macro-briefs',
  },
  'patreon-traders': {
    status: 'valid',
    statusReason: 'Simulated Patreon creator community',
    name: 'Patreon Pro Trading Signals',
    description: 'Tier-supporter discord server for live trading calls and trade setups.',
    approximateMemberCount: 1900,
    approximatePresenceCount: 310,
    features: ['COMMUNITY'],
    channelName: 'vip-alerts',
  },
  'x-trading-desk': {
    status: 'valid',
    statusReason: 'Simulated Twitter/X trader community',
    name: 'X Day Trading Desk',
    description: 'Twitter / X community for day trading stocks, futures, and indices.',
    approximateMemberCount: 5600,
    approximatePresenceCount: 890,
    features: ['COMMUNITY'],
    channelName: 'market-flow',
  },
  'medium-crypto-hub': {
    status: 'valid',
    statusReason: 'Simulated Medium publication community',
    name: 'Medium Crypto & DeFi Publications',
    description: 'Writers and researchers community discussing cryptocurrency and trading.',
    approximateMemberCount: 2700,
    approximatePresenceCount: 380,
    features: ['COMMUNITY'],
    channelName: 'crypto-articles',
  },
  'quora-options-desk': {
    status: 'valid',
    statusReason: 'Simulated Quora options community',
    name: 'Quora Options & Equity Community',
    description: 'Q&A answers and options trading strategies community.',
    approximateMemberCount: 2400,
    approximatePresenceCount: 340,
    features: ['COMMUNITY'],
    channelName: 'options-qa',
  },
  'stocktwits-futures': {
    status: 'valid',
    statusReason: 'Simulated Stocktwits futures community',
    name: 'Stocktwits Futures Stream',
    description: 'Futures day traders, micro ES/NQ levels and market chatter.',
    approximateMemberCount: 6800,
    approximatePresenceCount: 950,
    features: ['COMMUNITY'],
    channelName: 'futures-room',
  },
  'wp-forex-traders': {
    status: 'valid',
    statusReason: 'Simulated WordPress trading blog community',
    name: 'WordPress Forex Blog Network',
    description: 'Forex trading blog authors and daily technical analysis contributors.',
    approximateMemberCount: 1800,
    approximatePresenceCount: 260,
    features: ['COMMUNITY'],
    channelName: 'fx-blog-posts',
  },
  'ff-scalping-crew': {
    status: 'valid',
    statusReason: 'Simulated ForexFactory forum community',
    name: 'ForexFactory Live Scalpers',
    description: 'ForexFactory community thread scalping sessions and news trading.',
    approximateMemberCount: 8900,
    approximatePresenceCount: 1350,
    features: ['COMMUNITY'],
    channelName: 'london-session',
  },
  'expired-test': {
    status: 'expired_or_revoked',
    statusReason: 'Simulated expired invite fixture for testing',
  },
  'rate-limit-test': {
    status: 'rate_limited',
    statusReason: 'Simulated rate limited invite fixture for testing',
  },
};

export async function verifyMockInvite(code: string): Promise<VerifiedInvite> {
  const canonicalUrl = `https://discord.gg/${code}`;
  const now = new Date().toISOString();

  const fixture = MOCK_COMMUNITIES[code];
  if (fixture) {
    const status = fixture.status || 'valid';
    return {
      code,
      canonicalUrl,
      status,
      statusReason: fixture.statusReason || 'Mock invite verification succeeded',
      community:
        status === 'valid'
          ? {
              id: `guild-mock-${code}`,
              name: fixture.name || code,
              description: fixture.description || null,
              approximateMemberCount: fixture.approximateMemberCount ?? 3500,
              approximatePresenceCount: fixture.approximatePresenceCount ?? 500,
              icon: null,
              banner: null,
              splash: null,
              verificationLevel: 1,
              features: fixture.features || ['COMMUNITY'],
              vanityUrlCode: fixture.vanityUrlCode ?? null,
            }
          : null,
      channelId: `channel-mock-${code}`,
      channelName: fixture.channelName || 'general',
      inviterUsername: 'MockSystem',
      expiresAt: null,
      lastVerifiedAt: now,
      httpStatus: status === 'valid' ? 200 : status === 'expired_or_revoked' ? 404 : 429,
    };
  }

  // Handle simulated status patterns for arbitrary mock codes
  const lower = code.toLowerCase();
  if (lower.includes('expired') || lower.includes('invalid') || lower.includes('revoked')) {
    return {
      code,
      canonicalUrl,
      status: 'expired_or_revoked',
      statusReason: 'Simulated expired invite fixture',
      lastVerifiedAt: now,
      httpStatus: 404,
    };
  }

  if (lower.includes('ratelimit')) {
    return {
      code,
      canonicalUrl,
      status: 'rate_limited',
      statusReason: 'Simulated Discord API rate limit fixture',
      lastVerifiedAt: now,
      httpStatus: 429,
    };
  }

  // Default deterministic valid community for other mock codes
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  const members = 1000 + (hash % 9000);
  const presences = Math.round(members * 0.15);
  const cleanName = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    code,
    canonicalUrl,
    status: 'valid',
    statusReason: 'Deterministic simulated Discord community',
    community: {
      id: `guild-sim-${code}`,
      name: `${cleanName} Discord`,
      description: `Simulated trading community for ${cleanName}.`,
      approximateMemberCount: members,
      approximatePresenceCount: presences,
      icon: null,
      banner: null,
      splash: null,
      verificationLevel: 1,
      features: ['COMMUNITY'],
      vanityUrlCode: null,
    },
    channelId: `channel-${code}`,
    channelName: 'general',
    inviterUsername: 'MockAdmin',
    expiresAt: null,
    lastVerifiedAt: now,
    httpStatus: 200,
  };
}

