import {
  CommunityMetadata,
  DiscoveredInvite,
  identifySourcePlatform,
  RankedInviteResult,
  SearchJob,
  SearchJobParams,
  SearchJobProgress,
  VerifiedInvite,
  compareRankedResults,
} from '@discord-link-hunter/core';
import { getDbClient, isDatabaseConnectedSync } from './client.js';
import * as schema from './schema.js';
import { eq, desc, inArray } from 'drizzle-orm';
import { getConfig } from '@discord-link-hunter/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LinkHunterRepository {
  isMock: boolean;
  saveJob(job: SearchJob): Promise<void>;
  updateJobProgress(id: string, progress: SearchJobProgress, status?: SearchJob['status']): Promise<void>;
  getJob(id: string): Promise<SearchJob | null>;
  deleteJob(id: string): Promise<boolean>;
  listJobs(limit?: number): Promise<SearchJob[]>;
  saveResults(jobId: string, results: RankedInviteResult[]): Promise<void>;
  getJobResults(jobId: string): Promise<RankedInviteResult[]>;
  recordProviderUsage(provider: string, count: number, credits?: number, error?: string): Promise<void>;
  getProviderStats(): Promise<Record<string, { requests: number; credits: number; errors: number }>>;
}

export class InMemoryRepository implements LinkHunterRepository {
  isMock = true;
  private jobs = new Map<string, SearchJob>();
  private jobResults = new Map<string, RankedInviteResult[]>();
  private storageDir: string;
  private storageFile: string;
  private usageStats: Record<string, { requests: number; credits: number; errors: number }> = {
    serper: { requests: 0, credits: 0, errors: 0 },
    tavily: { requests: 0, credits: 0, errors: 0 },
    mock: { requests: 0, credits: 0, errors: 0 },
  };

  constructor() {
    this.storageDir = path.resolve(process.cwd(), 'data');
    this.storageFile = path.join(this.storageDir, 'jobs-store.json');

    const loaded = this.loadFromFile();
    if (!loaded) {
      this.seedMockData();
      this.persistToFile();
    }
  }

  private persistToFile(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      const data = {
        jobs: Array.from(this.jobs.entries()),
        jobResults: Array.from(this.jobResults.entries()),
        usageStats: this.usageStats,
      };
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // In-memory fallback if file write is not permitted
    }
  }

  private loadFromFile(): boolean {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.jobs)) {
          this.jobs = new Map(parsed.jobs);
        }
        if (Array.isArray(parsed.jobResults)) {
          this.jobResults = new Map(parsed.jobResults);
        }
        if (parsed.usageStats) {
          this.usageStats = parsed.usageStats;
        }
        return this.jobs.size > 0;
      }
    } catch {
      // Ignore read errors
    }
    return false;
  }

  async saveJob(job: SearchJob): Promise<void> {
    this.jobs.set(job.id, { ...job });
    this.persistToFile();
  }

  async updateJobProgress(id: string, progress: SearchJobProgress, status?: SearchJob['status']): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      job.progress = { ...progress };
      if (status) job.status = status;
      if (status === 'completed' || status === 'failed') {
        job.completedAt = new Date().toISOString();
      }
      this.jobs.set(id, job);
      this.persistToFile();
    }
  }

  async getJob(id: string): Promise<SearchJob | null> {
    return this.jobs.get(id) || null;
  }

  async deleteJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'queued' || job.status === 'running') {
      throw new Error('Cannot delete a queued or running job; wait for completion or cancel it first.');
    }
    this.jobs.delete(id);
    this.jobResults.delete(id);
    this.persistToFile();
    return true;
  }

  async listJobs(limit = 20): Promise<SearchJob[]> {
    return Array.from(this.jobs.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async saveResults(jobId: string, results: RankedInviteResult[]): Promise<void> {
    const sorted = [...results].sort(compareRankedResults);
    this.jobResults.set(jobId, sorted);
    const job = this.jobs.get(jobId);
    if (job) {
      job.results = sorted;
      this.jobs.set(jobId, job);
    }
    this.persistToFile();
  }

  async getJobResults(jobId: string): Promise<RankedInviteResult[]> {
    const results = this.jobResults.get(jobId) || [];
    return [...results].sort(compareRankedResults);
  }

  async recordProviderUsage(provider: string, count: number, credits = 0, error?: string): Promise<void> {
    if (!this.usageStats[provider]) {
      this.usageStats[provider] = { requests: 0, credits: 0, errors: 0 };
    }
    this.usageStats[provider].requests += count;
    this.usageStats[provider].credits += credits;
    if (error) {
      this.usageStats[provider].errors += 1;
    }
    this.persistToFile();
  }

  async getProviderStats(): Promise<Record<string, { requests: number; credits: number; errors: number }>> {
    return { ...this.usageStats };
  }

  private seedMockData() {
    const mockJobId = 'job-seed-demo-01';
    const mockResults: RankedInviteResult[] = [
      {
        invite: {
          code: 'gold-scalpers-vip',
          canonicalUrl: 'https://discord.gg/gold-scalpers-vip',
          status: 'valid',
          statusReason: 'Discord invite confirmed active and valid',
          community: {
            id: 'guild-gold-202',
            name: 'Gold & XAUUSD Scalpers',
            description: 'Dedicated to Gold/XAUUSD price action and intraday trading.',
            approximateMemberCount: 8200,
            approximatePresenceCount: 1450,
          },
          lastVerifiedAt: new Date().toISOString(),
        },
        sources: [
          {
            rawUrl: 'https://discord.gg/gold-scalpers-vip',
            code: 'gold-scalpers-vip',
            canonicalUrl: 'https://discord.gg/gold-scalpers-vip',
            sourceUrl: 'https://goldtradershub.com/invite',
            sourceDomain: 'goldtradershub.com',
            provider: 'mock',
            discoveredAt: new Date().toISOString(),
            contextSnippet: 'Live New York session gold scalping: https://discord.gg/gold-scalpers-vip with 8200 members',
          },
        ],
        score: 95,
        scoreBreakdown: {
          topicRelevance: 35,
          inviteValidity: 20,
          languageMatch: 15,
          sourceCredibility: 7,
          freshness: 10,
          activitySignal: 10,
          total: 95,
          explanations: ['Matched topic: xauusd', 'Verified 8,200 members', 'Target language en matched'],
        },
        detectedTopics: ['xauusd', 'day_trading', 'technical_analysis'],
        detectedLanguage: 'en',
        isVerifiedFact: true,
        isSimulated: true,
      },
      {
        invite: {
          code: 'fx-elite-club',
          canonicalUrl: 'https://discord.gg/fx-elite-club',
          status: 'valid',
          statusReason: 'Discord invite confirmed active and valid',
          community: {
            id: 'guild-fx-101',
            name: 'Global Forex Traders Club',
            description: 'Live forex market analysis, webinars, and educational signals.',
            approximateMemberCount: 4520,
            approximatePresenceCount: 680,
          },
          lastVerifiedAt: new Date().toISOString(),
        },
        sources: [
          {
            rawUrl: 'https://discord.gg/fx-elite-club',
            code: 'fx-elite-club',
            canonicalUrl: 'https://discord.gg/fx-elite-club',
            sourceUrl: 'https://tradingdirectory.org/forex-traders-club',
            sourceDomain: 'tradingdirectory.org',
            provider: 'mock',
            discoveredAt: new Date().toISOString(),
            contextSnippet: 'Join premier FX trading community https://discord.gg/fx-elite-club with 4500 active traders',
          },
        ],
        score: 92,
        scoreBreakdown: {
          topicRelevance: 35,
          inviteValidity: 20,
          languageMatch: 15,
          sourceCredibility: 7,
          freshness: 10,
          activitySignal: 8,
          total: 92,
          explanations: ['Matched topic: forex', 'Active community with 4,520 members', 'Target language en matched'],
        },
        detectedTopics: ['forex', 'education'],
        detectedLanguage: 'en',
        isVerifiedFact: true,
        isSimulated: true,
      },
      {
        invite: {
          code: 'arab-gold-traders',
          canonicalUrl: 'https://discord.gg/arab-gold-traders',
          status: 'valid',
          statusReason: 'Discord invite confirmed active and valid',
          community: {
            id: 'guild-ar-303',
            name: 'متداولو الذهب والعملات العرب',
            description: 'مجتمع تعليمي مجاني للتحليل الفني وتداول الذهب.',
            approximateMemberCount: 3100,
            approximatePresenceCount: 420,
          },
          lastVerifiedAt: new Date().toISOString(),
        },
        sources: [
          {
            rawUrl: 'https://discord.gg/arab-gold-traders',
            code: 'arab-gold-traders',
            canonicalUrl: 'https://discord.gg/arab-gold-traders',
            sourceUrl: 'https://arab-traders.com/gold-discord',
            sourceDomain: 'arab-traders.com',
            provider: 'mock',
            discoveredAt: new Date().toISOString(),
            contextSnippet: 'سيرفر ديسكورد لتداول الذهب https://discord.gg/arab-gold-traders',
          },
        ],
        score: 88,
        scoreBreakdown: {
          topicRelevance: 35,
          inviteValidity: 20,
          languageMatch: 15,
          sourceCredibility: 7,
          freshness: 10,
          activitySignal: 8,
          total: 88,
          explanations: ['Matched topic: xauusd', 'Arabic language match', 'Active members: 3,100'],
        },
        detectedTopics: ['xauusd', 'technical_analysis', 'education'],
        detectedLanguage: 'ar',
        isVerifiedFact: true,
        isSimulated: true,
      },
    ];

    mockResults.sort(compareRankedResults);

    const seedJob: SearchJob = {
      id: mockJobId,
      ownerId: 'system-seed',
      params: {
        topics: ['forex', 'xauusd'],
        languages: ['en', 'ar'],
        limit: 10,
        depth: 1,
      },
      mode: 'mock',
      status: 'completed',
      isSimulated: true,
      progress: {
        queriesPlanned: 4,
        queriesAttempted: 4,
        queriesSuccessful: 4,
        queriesFailed: 0,
        urlsDiscovered: 6,
        invitesExtracted: 3,
        uniqueInvites: 3,
        invitesChecked: 3,
        validInvites: 3,
        invalidInvites: 0,
        restrictedOrUnverified: 0,
        queriesExecuted: 4,
        invitesVerified: 3,
        validInvitesFound: 3,
        providerErrors: [],
      },
      results: mockResults,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      startedAt: new Date(Date.now() - 3590000).toISOString(),
      completedAt: new Date(Date.now() - 3570000).toISOString(),
    };

    this.jobs.set(mockJobId, seedJob);
    this.jobResults.set(mockJobId, mockResults);
  }
}

export class PostgresRepository implements LinkHunterRepository {
  isMock = false;

  async saveJob(job: SearchJob): Promise<void> {
    const db = getDbClient();
    if (!db) throw new Error('Database client unavailable');

    await db
      .insert(schema.searchJobs)
      .values({
        id: job.id,
        ownerId: job.ownerId ?? null,
        topics: job.params.topics,
        languages: job.params.languages,
        searchLimit: job.params.limit,
        depth: job.params.depth,
        mode: job.mode,
        status: job.status,
        progress: job.progress,
        errorDetails: job.errorDetails ?? null,
        isSimulated: Boolean(job.isSimulated),
        plannedQueries: job.plannedQueries ?? null,
        estimatedRequests: job.estimatedRequests ?? 0,
        estimatedCredits: job.estimatedCredits ?? 0,
        dryRunExplanation: job.dryRunExplanation ?? null,
        languageFilterNotice: job.languageFilterNotice ?? null,
        createdAt: new Date(job.createdAt),
        startedAt: job.startedAt ? new Date(job.startedAt) : null,
        completedAt: job.completedAt ? new Date(job.completedAt) : null,
      })
      .onConflictDoUpdate({
        target: schema.searchJobs.id,
        set: {
          status: job.status,
          progress: job.progress,
          errorDetails: job.errorDetails ?? null,
          plannedQueries: job.plannedQueries ?? null,
          estimatedRequests: job.estimatedRequests ?? 0,
          estimatedCredits: job.estimatedCredits ?? 0,
          dryRunExplanation: job.dryRunExplanation ?? null,
          languageFilterNotice: job.languageFilterNotice ?? null,
          startedAt: job.startedAt ? new Date(job.startedAt) : null,
          completedAt: job.completedAt ? new Date(job.completedAt) : null,
        },
      });
  }

  async updateJobProgress(id: string, progress: SearchJobProgress, status?: SearchJob['status']): Promise<void> {
    const db = getDbClient();
    if (!db) return;

    const updateData: any = {
      progress,
    };
    if (status) {
      updateData.status = status;
      if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date();
      }
    }

    await db.update(schema.searchJobs).set(updateData).where(eq(schema.searchJobs.id, id));
  }

  /** Permanently delete a finished job, its results, and exclusively owned
   * invite/source/community data. Shared cross-job records are preserved. */
  async deleteJob(id: string): Promise<boolean> {
    const db = getDbClient();
    if (!db) throw new Error('Database client unavailable');

    return db.transaction(async (tx) => {
      const jobs = await tx.select({ status: schema.searchJobs.status })
        .from(schema.searchJobs).where(eq(schema.searchJobs.id, id)).limit(1);
      if (jobs.length === 0) return false;
      if (jobs[0].status === 'queued' || jobs[0].status === 'running') {
        throw new Error('Cannot delete a queued or running job; wait for completion or cancel it first.');
      }

      const jobLinks = await tx.select({ code: schema.searchJobResults.inviteCode })
        .from(schema.searchJobResults).where(eq(schema.searchJobResults.jobId, id));
      const inviteCodes = [...new Set(jobLinks.map((row) => row.code))];
      const sourceIds = new Set<string>();
      const communityIds = new Set<string>();

      if (inviteCodes.length > 0) {
        const references = await tx.select({ sourceId: schema.inviteSources.sourceId })
          .from(schema.inviteSources).where(inArray(schema.inviteSources.inviteCode, inviteCodes));
        for (const row of references) sourceIds.add(row.sourceId);
        const metadata = await tx.select({ communityId: schema.invites.communityId })
          .from(schema.invites).where(inArray(schema.invites.code, inviteCodes));
        for (const row of metadata) {
          if (row.communityId) communityIds.add(row.communityId);
        }
      }

      // The existing ON DELETE CASCADE removes search_job_results automatically.
      await tx.delete(schema.searchJobs).where(eq(schema.searchJobs.id, id));

      for (const code of inviteCodes) {
        const stillUsed = await tx.select({ code: schema.searchJobResults.inviteCode })
          .from(schema.searchJobResults).where(eq(schema.searchJobResults.inviteCode, code)).limit(1);
        if (stillUsed.length === 0) {
          // invite_sources and verification_history cascade with the invite.
          await tx.delete(schema.invites).where(eq(schema.invites.code, code));
        }
      }
      for (const sourceId of sourceIds) {
        const stillUsed = await tx.select({ id: schema.inviteSources.sourceId })
          .from(schema.inviteSources).where(eq(schema.inviteSources.sourceId, sourceId)).limit(1);
        if (stillUsed.length === 0) {
          await tx.delete(schema.sources).where(eq(schema.sources.id, sourceId));
        }
      }
      for (const communityId of communityIds) {
        const stillUsed = await tx.select({ id: schema.invites.code })
          .from(schema.invites).where(eq(schema.invites.communityId, communityId)).limit(1);
        if (stillUsed.length === 0) {
          await tx.delete(schema.communities).where(eq(schema.communities.id, communityId));
        }
      }
      // provider_usage is aggregate data with no job_id; do not erase shared quotas.
      return true;
    });
  }

  async getJob(id: string): Promise<SearchJob | null> {
    const db = getDbClient();
    if (!db) return null;

    const rows = await db.select().from(schema.searchJobs).where(eq(schema.searchJobs.id, id));
    if (rows.length === 0) return null;

    const r = rows[0];
    const results = await this.getJobResults(id);

    return {
      id: r.id,
      ownerId: r.ownerId ?? undefined,
      params: {
        topics: (r.topics as any) || [],
        languages: (r.languages as any) || [],
        limit: r.searchLimit,
        depth: r.depth,
        dryRun: r.status === 'dry_run_plan' || Boolean(r.plannedQueries),
      },
      mode: r.mode as any,
      status: r.status as any,
      progress: r.progress as any,
      results,
      errorDetails: r.errorDetails ?? undefined,
      isSimulated: r.isSimulated ?? false,
      plannedQueries: (r.plannedQueries as any) ?? undefined,
      estimatedRequests: r.estimatedRequests ?? undefined,
      estimatedCredits: r.estimatedCredits ?? undefined,
      dryRunExplanation: r.dryRunExplanation ?? undefined,
      languageFilterNotice: r.languageFilterNotice ?? undefined,
      createdAt: r.createdAt.toISOString(),
      startedAt: r.startedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
    };
  }

  async listJobs(limit = 20): Promise<SearchJob[]> {
    const db = getDbClient();
    if (!db) return [];

    const rows = await db
      .select()
      .from(schema.searchJobs)
      .orderBy(desc(schema.searchJobs.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      ownerId: r.ownerId ?? undefined,
      params: {
        topics: (r.topics as any) || [],
        languages: (r.languages as any) || [],
        limit: r.searchLimit,
        depth: r.depth,
        dryRun: r.status === 'dry_run_plan' || Boolean(r.plannedQueries),
      },
      mode: r.mode as any,
      status: r.status as any,
      progress: r.progress as any,
      results: [],
      errorDetails: r.errorDetails ?? undefined,
      isSimulated: r.isSimulated ?? false,
      plannedQueries: (r.plannedQueries as any) ?? undefined,
      estimatedRequests: r.estimatedRequests ?? undefined,
      estimatedCredits: r.estimatedCredits ?? undefined,
      dryRunExplanation: r.dryRunExplanation ?? undefined,
      languageFilterNotice: r.languageFilterNotice ?? undefined,
      createdAt: r.createdAt.toISOString(),
      startedAt: r.startedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
    }));
  }

  async saveResults(jobId: string, results: RankedInviteResult[]): Promise<void> {
    const db = getDbClient();
    if (!db) return;

    for (const res of results) {
      if (res.invite.community) {
        await db
          .insert(schema.communities)
          .values({
            id: res.invite.community.id,
            name: res.invite.community.name,
            description: res.invite.community.description ?? null,
            detectedLanguage: res.detectedLanguage,
            topics: res.detectedTopics,
            memberCount: res.invite.community.approximateMemberCount ?? null,
            presenceCount: res.invite.community.approximatePresenceCount ?? null,
            icon: res.invite.community.icon ?? null,
            banner: res.invite.community.banner ?? null,
            splash: res.invite.community.splash ?? null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.communities.id,
            set: {
              name: res.invite.community.name,
              description: res.invite.community.description ?? null,
              memberCount: res.invite.community.approximateMemberCount ?? null,
              presenceCount: res.invite.community.approximatePresenceCount ?? null,
              updatedAt: new Date(),
            },
          });
      }

      await db
        .insert(schema.invites)
        .values({
          code: res.invite.code,
          canonicalUrl: res.invite.canonicalUrl,
          status: res.invite.status,
          statusReason: res.invite.statusReason ?? null,
          communityId: res.invite.community?.id ?? null,
          channelId: res.invite.channelId ?? null,
          channelName: res.invite.channelName ?? null,
          inviterUsername: res.invite.inviterUsername ?? null,
          expiresAt: res.invite.expiresAt ? new Date(res.invite.expiresAt) : null,
          lastCheckedAt: new Date(res.invite.lastVerifiedAt),
        })
        .onConflictDoUpdate({
          target: schema.invites.code,
          set: {
            status: res.invite.status,
            statusReason: res.invite.statusReason ?? null,
            lastCheckedAt: new Date(res.invite.lastVerifiedAt),
          },
        });

      const resultId = `${jobId}_${res.invite.code}`;
      await db
        .insert(schema.searchJobResults)
        .values({
          id: resultId,
          jobId,
          inviteCode: res.invite.code,
          score: res.score,
          scoreBreakdown: res.scoreBreakdown,
          detectedTopics: res.detectedTopics,
          detectedLanguage: res.detectedLanguage,
        })
        .onConflictDoNothing();

      // Persist source attribution
      if (res.sources && res.sources.length > 0) {
        for (const src of res.sources) {
          const sourceUrl = src.sourceUrl || src.rawUrl;
          const sourceId = Buffer.from(sourceUrl).toString('base64url').slice(0, 64) || `src_${Date.now()}`;
          await db
            .insert(schema.sources)
            .values({
              id: sourceId,
              url: sourceUrl,
              domain: src.sourceDomain ?? null,
              sourceType: src.provider || 'unknown',
            })
            .onConflictDoNothing();

          await db
            .insert(schema.inviteSources)
            .values({
              inviteCode: res.invite.code,
              sourceId,
              contextSnippet: src.contextSnippet ?? null,
            })
            .onConflictDoNothing();
        }
      }

      // Record verification history audit row
      await db
        .insert(schema.verificationHistory)
        .values({
          id: `vh_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          inviteCode: res.invite.code,
          status: res.invite.status,
          statusReason: res.invite.statusReason ?? null,
          httpStatus: res.invite.status === 'valid' ? 200 : undefined,
          memberCount: res.invite.community?.approximateMemberCount ?? null,
          presenceCount: res.invite.community?.approximatePresenceCount ?? null,
        })
        .onConflictDoNothing();
    }
  }

  async getJobResults(jobId: string): Promise<RankedInviteResult[]> {
    const db = getDbClient();
    if (!db) return [];

    const rows = await db
      .select({
        result: schema.searchJobResults,
        invite: schema.invites,
        community: schema.communities,
      })
      .from(schema.searchJobResults)
      .innerJoin(schema.invites, eq(schema.searchJobResults.inviteCode, schema.invites.code))
      .leftJoin(schema.communities, eq(schema.invites.communityId, schema.communities.id))
      .where(eq(schema.searchJobResults.jobId, jobId))
      .orderBy(desc(schema.searchJobResults.score));

    if (rows.length === 0) return [];

    const inviteCodes = rows.map((r) => r.invite.code);
    const sourceRows = await db
      .select({
        inviteCode: schema.inviteSources.inviteCode,
        contextSnippet: schema.inviteSources.contextSnippet,
        source: schema.sources,
      })
      .from(schema.inviteSources)
      .innerJoin(schema.sources, eq(schema.inviteSources.sourceId, schema.sources.id))
      .where(inArray(schema.inviteSources.inviteCode, inviteCodes));

    const sourcesByCode = new Map<string, DiscoveredInvite[]>();
    for (const sr of sourceRows) {
      const list = sourcesByCode.get(sr.inviteCode) || [];
      const platformConfig = identifySourcePlatform(sr.source.domain || sr.source.url);
      list.push({
        rawUrl: sr.source.url,
        code: sr.inviteCode,
        canonicalUrl: `https://discord.gg/${sr.inviteCode}`,
        sourceUrl: sr.source.url,
        sourceDomain: sr.source.domain ?? undefined,
        sourcePlatform: platformConfig?.id || (sr.source.domain ? 'general_web' : undefined),
        sourcePlatformName: platformConfig?.name || sr.source.domain || undefined,
        sourceCategory: platformConfig?.category || (sr.source.domain ? 'general_web' : undefined),
        provider: (sr.source.sourceType as any) || 'unknown',
        discoveredAt: sr.source.discoveredAt.toISOString(),
        contextSnippet: sr.contextSnippet ?? undefined,
      });
      sourcesByCode.set(sr.inviteCode, list);
    }

    return rows.map(({ result, invite, community }) => ({
      invite: {
        code: invite.code,
        canonicalUrl: invite.canonicalUrl,
        status: invite.status as any,
        statusReason: invite.statusReason ?? undefined,
        community: community
          ? {
              id: community.id,
              name: community.name,
              description: community.description ?? null,
              approximateMemberCount: community.memberCount ?? null,
              approximatePresenceCount: community.presenceCount ?? null,
              icon: community.icon ?? null,
              banner: community.banner ?? null,
              splash: community.splash ?? null,
            }
          : null,
        channelId: invite.channelId ?? null,
        channelName: invite.channelName ?? null,
        inviterUsername: invite.inviterUsername ?? null,
        expiresAt: invite.expiresAt?.toISOString() ?? null,
        lastVerifiedAt: invite.lastCheckedAt.toISOString(),
      },
      sources: sourcesByCode.get(invite.code) || [],
      score: result.score,
      scoreBreakdown: result.scoreBreakdown as any,
      detectedTopics: (result.detectedTopics as any) || [],
      detectedLanguage: (result.detectedLanguage as any) || 'en',
      isVerifiedFact: invite.status === 'valid',
    })).sort(compareRankedResults);
  }

  async recordProviderUsage(provider: string, count: number, credits = 0, error?: string): Promise<void> {
    const db = getDbClient();
    if (!db) return;

    await db.insert(schema.providerUsage).values({
      id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
      provider,
      requestCount: count,
      estimatedCostCredits: credits,
      errorCategory: error ?? null,
    });
  }

  async getProviderStats(): Promise<Record<string, { requests: number; credits: number; errors: number }>> {
    const db = getDbClient();
    if (!db) {
      return {
        serper: { requests: 0, credits: 0, errors: 0 },
        tavily: { requests: 0, credits: 0, errors: 0 },
        mock: { requests: 0, credits: 0, errors: 0 },
      };
    }

    const rows = await db.select().from(schema.providerUsage);
    const stats: Record<string, { requests: number; credits: number; errors: number }> = {
      serper: { requests: 0, credits: 0, errors: 0 },
      tavily: { requests: 0, credits: 0, errors: 0 },
      mock: { requests: 0, credits: 0, errors: 0 },
    };

    for (const r of rows) {
      const p = r.provider;
      if (!stats[p]) {
        stats[p] = { requests: 0, credits: 0, errors: 0 };
      }
      stats[p].requests += r.requestCount;
      stats[p].credits += r.estimatedCostCredits ?? 0;
      if (r.errorCategory) {
        stats[p].errors += 1;
      }
    }

    return stats;
  }
}

let _repoInstance: LinkHunterRepository | null = null;

export function resetRepositoryInstance(instance?: LinkHunterRepository | null): void {
  _repoInstance = instance || null;
}


export function getRepository(): LinkHunterRepository {
  if (_repoInstance) {
    return _repoInstance;
  }

  const config = getConfig();

  const databaseConfigured = Boolean(
    config.DATABASE_URL || config.DIRECT_URL
  );

  if (databaseConfigured) {
    if (!isDatabaseConnectedSync()) {
      if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
        _repoInstance = new InMemoryRepository();
        return _repoInstance;
      }
      throw new Error(
        'PostgreSQL is configured but has not been verified. ' +
        'Run the database connection test before initializing the repository.'
      );
    }

    _repoInstance = new PostgresRepository();

    console.log('[DB] Using PostgreSQL repository.');

    return _repoInstance;
  }

  if (config.NODE_ENV === 'production') {
    throw new Error(
      'Production cannot use the in-memory repository.'
    );
  }

  _repoInstance = new InMemoryRepository();

  console.warn('[DB] Using development in-memory repository.');

  return _repoInstance;
}
