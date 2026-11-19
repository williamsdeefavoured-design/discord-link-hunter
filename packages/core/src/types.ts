import { z } from 'zod';

export const SUPPORTED_LANGUAGES = ['en', 'de', 'es', 'pt', 'fr', 'ar', 'it', 'tr', 'nl'] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];
export type DetectedLanguage = LanguageCode | 'unknown';

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

export const COUNTRY_EVIDENCE_STATUSES = [
  'verified',
  'self_declared',
  'unknown',
] as const;
export type CountryEvidenceStatus = (typeof COUNTRY_EVIDENCE_STATUSES)[number];

export interface CountryEvidence {
  countryCode: string | null; // ISO 3166-1 alpha-2 code or null
  countryName: string | null; // Official country name or null
  status: CountryEvidenceStatus;
  sourceUrl?: string | null;
  supportingEvidence?: string | null;
  lastVerifiedAt: string | null;
}

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

export type SourceCategory =
  | 'discussion_forum'
  | 'social_network'
  | 'newsletter_publishing'
  | 'creator_platform'
  | 'publishing_platform'
  | 'q_and_a'
  | 'charting_community'
  | 'microblogging'
  | 'trading_blogs'
  | 'trading_forums'
  | 'general_web';

export type SourceAccessMethod = 'public_search' | 'authorized_api';

export interface ResearchSourceConfig {
  id: string;
  name: string;
  category: SourceCategory;
  domains: string[];
  accessMethod: SourceAccessMethod;
  enabled: boolean;
  searchOperatorTemplate: string;
  rateLimitPerMinute?: number;
  requiresAuth?: boolean;
  apiDocsUrl?: string;
  notes?: string;
}

export interface PotentialCommunityLead {
  id: string;
  sourcePlatform: string;
  sourcePlatformName: string;
  sourceCategory: SourceCategory;
  sourceUrl: string;
  sourceDomain: string;
  title: string;
  snippet: string;
  topic: TradingTopic;
  language: LanguageCode;
  discoveredAt: string;
  hasConfirmedInvite: false;
  reason: string;
}

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
  countryEvidence?: CountryEvidence | null;
}

export interface DiscoveredInvite {
  rawUrl: string;
  code: string;
  canonicalUrl: string;
  sourceUrl?: string;
  sourceDomain?: string;
  sourcePlatform?: string;
  sourcePlatformName?: string;
  sourceCategory?: SourceCategory;
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
  detectedLanguage: DetectedLanguage;
  countryEvidence?: CountryEvidence | null;
  isVerifiedFact: boolean;
  isSimulated?: boolean;
  alternateInviteCodes?: string[];
}

export interface SearchJobParams {
  topics: TradingTopic[];
  languages: LanguageCode[];
  country?: string;
  limit: number;
  depth: number;
  minMembers?: number;
  sourcePreference?: 'all' | 'serper' | 'tavily';
  dryRun?: boolean;
  targetPlatforms?: string[];
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
  languageFilteredOutCount?: number;
  countryFilteredOutCount?: number;
  uncheckedInvites?: number;
  discordVerificationRateLimited?: boolean;
  potentialLeadsCount?: number;
  leadsWithoutInvite?: number;
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
  platform?: string;
}

export interface SearchJob {
  id: string;
  ownerId?: string;
  params: SearchJobParams;
  mode: 'mock' | 'live';
  status: JobStatus;
  progress: SearchJobProgress;
  results: RankedInviteResult[];
  potentialLeads?: PotentialCommunityLead[];
  errorDetails?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  isSimulated?: boolean;
  plannedQueries?: PlannedQueryItem[];
  estimatedRequests?: number;
  estimatedCredits?: number;
  dryRunExplanation?: string;
  languageFilterNotice?: string;
  countryFilterNotice?: string;
}
