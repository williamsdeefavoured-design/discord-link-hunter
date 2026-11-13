import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, primaryKey } from 'drizzle-orm/pg-core';

export const communities = pgTable('communities', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  detectedLanguage: varchar('detected_language', { length: 8 }),
  topics: jsonb('topics').$type<string[]>(),
  memberCount: integer('member_count'),
  presenceCount: integer('presence_count'),
  icon: text('icon'),
  banner: text('banner'),
  splash: text('splash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invites = pgTable('invites', {
  code: varchar('code', { length: 64 }).primaryKey(),
  canonicalUrl: text('canonical_url').notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  statusReason: text('status_reason'),
  communityId: varchar('community_id', { length: 64 }).references(() => communities.id, { onDelete: 'set null' }),
  channelId: varchar('channel_id', { length: 64 }),
  channelName: text('channel_name'),
  inviterUsername: text('inviter_username'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sources = pgTable('sources', {
  id: text('id').primaryKey(),
  url: text('url').notNull().unique(),
  domain: text('domain'),
  sourceType: varchar('source_type', { length: 32 }).notNull(),
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
});

export const inviteSources = pgTable(
  'invite_sources',
  {
    inviteCode: varchar('invite_code', { length: 64 })
      .notNull()
      .references(() => invites.code, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    contextSnippet: text('context_snippet'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.inviteCode, t.sourceId] })]
);

export const searchJobs = pgTable('search_jobs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  ownerId: text('owner_id'),
  topics: jsonb('topics').$type<string[]>().notNull(),
  languages: jsonb('languages').$type<string[]>().notNull(),
  searchLimit: integer('search_limit').notNull(),
  depth: integer('depth').notNull(),
  mode: varchar('mode', { length: 16 }).notNull(),
  status: varchar('status', { length: 24 }).notNull(),
  progress: jsonb('progress').$type<any>().notNull(),
  errorDetails: text('error_details'),
  isSimulated: boolean('is_simulated').default(false),
  plannedQueries: jsonb('planned_queries').$type<any>(),
  estimatedRequests: integer('estimated_requests').default(0),
  estimatedCredits: integer('estimated_credits').default(0),
  dryRunExplanation: text('dry_run_explanation'),
  languageFilterNotice: text('language_filter_notice'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const searchJobResults = pgTable('search_job_results', {
  id: text('id').primaryKey(),
  jobId: varchar('job_id', { length: 64 })
    .notNull()
    .references(() => searchJobs.id, { onDelete: 'cascade' }),
  inviteCode: varchar('invite_code', { length: 64 })
    .notNull()
    .references(() => invites.code, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  scoreBreakdown: jsonb('score_breakdown').$type<any>().notNull(),
  detectedTopics: jsonb('detected_topics').$type<string[]>(),
  detectedLanguage: varchar('detected_language', { length: 8 }),
  isSimulated: boolean('is_simulated').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const verificationHistory = pgTable('verification_history', {
  id: varchar('id', { length: 64 }).primaryKey(),
  inviteCode: varchar('invite_code', { length: 64 })
    .notNull()
    .references(() => invites.code, { onDelete: 'cascade' }),
  status: varchar('status', { length: 32 }).notNull(),
  statusReason: text('status_reason'),
  httpStatus: integer('http_status'),
  memberCount: integer('member_count'),
  presenceCount: integer('presence_count'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).defaultNow().notNull(),
});

export const providerUsage = pgTable('provider_usage', {
  id: text('id').primaryKey(),
  provider: varchar('provider', { length: 32 }).notNull(),
  endpoint: text('endpoint'),
  requestCount: integer('request_count').notNull(),
  estimatedCostCredits: integer('estimated_cost_credits').default(0),
  errorCategory: text('error_category'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
});

