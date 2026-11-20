import { DiscoveredInvite, LanguageCode, SearchJobParams, TradingTopic } from '@discord-link-hunter/core';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  pageContent?: string;
  date?: string;
}

export interface ProviderSearchResult {
  provider: 'serper' | 'tavily' | 'mock';
  query: string;
  items: SearchResultItem[];
  creditCost?: number;
  statusCode: number;
  durationMs: number;
  error?: string;
  retryAfterSeconds?: number;
  isPermanentError?: boolean;
}

export interface SearchProviderOptions {
  limit?: number;
  language?: LanguageCode;
  country?: string;
  depth?: number;
  includePageContent?: boolean;
}

export interface SearchProvider {
  name: 'serper' | 'tavily' | 'mock';
  isAvailable(): boolean;
  search(query: string, options?: SearchProviderOptions): Promise<ProviderSearchResult>;
  getDailyRequestCount(): number;
}

export interface QueryPlanItem {
  query: string;
  topic: TradingTopic;
  language: LanguageCode;
  priority: number;
  platform?: string;
}

