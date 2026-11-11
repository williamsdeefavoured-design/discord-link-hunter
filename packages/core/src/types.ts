import { z } from 'zod';

export const SUPPORTED_LANGUAGES = ['en', 'de', 'es', 'pt', 'fr', 'ar'] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const TRADING_TOPICS = [
  'forex',
  'xauusd',
  'stocks',
  'crypto',
  'futures',
  'options',
  'indices',
  'day_trading',
  'swing_trading',
  'investing',
  'technical_analysis',
  'education',
] as const;
export type TradingTopic = (typeof TRADING_TOPICS)[number];

export const INVITE_STATUSES = [
  'valid',
  'invalid',
  'expired_or_revoked',
  'rate_limited',
  'unavailable',
  'unknown',
] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const JOB_STATUSES = [
  'queued',
  'running',
  'partial',
  'completed',
  'dry_run_plan',
  'failed',
  'cancelled',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface CommunityMetadata {
  id: string; // Discord guild ID
  name: string;
  description?: string | null;
  approximateMemberCount?: number | null;
  approximatePresenceCount?: number | null;
  icon?: string | null;
  banner?: string | null;
  splash?: string | null;
  verificationLevel?: number;
  features?: string[];
  vanityUrlCode?: string | null;
}

export interface DiscoveredInvite {
  rawUrl: string;
  code: string;
  canonicalUrl: string;
  sourceUrl?: string;
  sourceDomain?: string;
  provider: 'serper' | 'tavily' | 'mock' | 'manual';
  discoveredAt: string;
  contextSnippet?: string;
}

export interface VerifiedInvite {
  code: string;
  canonicalUrl: string;
  status: InviteStatus;
  statusReason?: string;
  community?: CommunityMetadata | null;
  channelId?: string | null;
  channelName?: string | null;
  inviterUsername?: string | null;
  expiresAt?: string | null;
  lastVerifiedAt: string;
  httpStatus?: number;
  isSimulated?: boolean;
}

export interface ScoreBreakdown {
  topicRelevance: number; // max 35
  inviteValidity: number; // max 20
  languageMatch: number; // max 15
  sourceCredibility: number; // max 10
  freshness: number; // max 10
  activitySignal: number; // max 10
  total: number; // 0 - 100
  explanations: string[];
}

export interface RankedInviteResult {
  invite: VerifiedInvite;
  sources: DiscoveredInvite[];
  score: number;
  scoreBreakdown: ScoreBreakdown;
  detectedTopics: TradingTopic[];
  detectedLanguage: LanguageCode;
  isVerifiedFact: boolean;
  isSimulated?: boolean;
}

export interface SearchJobParams {
  topics: TradingTopic[];
  languages: LanguageCode[];
  limit: number;
  depth: number;
  minMembers?: number;
  sourcePreference?: 'all' | 'serper' | 'tavily';
  dryRun?: boolean;
}

export interface SearchJobProgress {
  queriesPlanned: number;
  queriesAttempted: number;
  queriesSuccessful: number;
  queriesFailed: number;
  urlsDiscovered: number;
  invitesExtracted: number;
  uniqueInvites: number;
  invitesChecked: number;
  validInvites: number;
  invalidInvites: number;
  restrictedOrUnverified: number;
  // Backwards compatibility aliases:
  queriesExecuted: number;
  invitesVerified: number;
  validInvitesFound: number;
  providerErrors: Array<{ provider: string; error: string; timestamp: string }>;
}

export interface PlannedQueryItem {
  query: string;
  topic: TradingTopic;
  language: LanguageCode;
  priority: number;
}

export interface SearchJob {
  id: string;
  ownerId?: string;
  params: SearchJobParams;
  mode: 'mock' | 'live';
  status: JobStatus;
  progress: SearchJobProgress;
  results: RankedInviteResult[];
  errorDetails?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  isSimulated?: boolean;
  plannedQueries?: PlannedQueryItem[];
  estimatedRequests?: number;
  estimatedCredits?: number;
  dryRunExplanation?: string;
}
