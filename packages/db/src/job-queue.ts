import {
  SearchJob,
  SearchJobParams,
  SearchJobProgress,
  verifyDiscordInvite,
  verifyMockInvite,
} from '@discord-link-hunter/core';
import {
  MockSearchAdapter,
  QueryPlanner,
  SearchOrchestrator,
  SearchProvider,
  SerperAdapter,
  TavilyAdapter,
} from '@discord-link-hunter/research';
import { getConfig } from '@discord-link-hunter/config';
import { getRepository, LinkHunterRepository } from './repositories.js';

export class JobQueueManager {
  private repo: LinkHunterRepository;

  constructor(repo?: LinkHunterRepository) {
    this.repo = repo || getRepository();
  }

  async createJob(params: SearchJobParams, ownerId?: string, forceMode?: 'mock' | 'live'): Promise<SearchJob> {
    const config = getConfig();
    const mode = forceMode || (config.SEARCH_MODE === 'live' ? 'live' : 'mock');

    const job: SearchJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ownerId,
      params,
      mode,
      status: 'queued',
      progress: {
        queriesPlanned: 0,
        queriesAttempted: 0,
        queriesSuccessful: 0,
        queriesFailed: 0,
        urlsDiscovered: 0,
        invitesExtracted: 0,
        uniqueInvites: 0,
        invitesChecked: 0,
        validInvites: 0,
        invalidInvites: 0,
        restrictedOrUnverified: 0,
        queriesExecuted: 0,
        invitesVerified: 0,
        validInvitesFound: 0,
        providerErrors: [],
      },
      results: [],
      createdAt: new Date().toISOString(),
      isSimulated: mode === 'mock',
    };

    await this.repo.saveJob(job);
    return job;
  }

  async processJob(jobId: string): Promise<SearchJob> {
    const job = await this.repo.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    if (job.status === 'cancelled') {
      return job;
    }

    const config = getConfig();
    const startTime = new Date().toISOString();
    job.status = 'running';
    job.startedAt = startTime;
    await this.repo.saveJob(job);

    try {
      // Configure providers according to job mode
      let orchestrator: SearchOrchestrator;

      if (job.mode === 'live') {
        // Enforce strict Live Mode without silent fallback to mock
        if (!config.SERPER_API_KEY && !config.TAVILY_API_KEY) {
          throw new Error(
            'Live Mode requires SERPER_API_KEY or TAVILY_API_KEY to be configured. No API keys found in environment.'
          );
        }

        let primary: SearchProvider;
        let secondary: SearchProvider | undefined;

        if (config.SERPER_API_KEY) {
          primary = new SerperAdapter(config.SERPER_API_KEY, config.SEARCH_DAILY_PROVIDER_REQUEST_CAP);
          if (config.TAVILY_API_KEY) {
            secondary = new TavilyAdapter(config.TAVILY_API_KEY, config.SEARCH_DAILY_PROVIDER_REQUEST_CAP);
          }
        } else {
          primary = new TavilyAdapter(config.TAVILY_API_KEY!, config.SEARCH_DAILY_PROVIDER_REQUEST_CAP);
        }

        orchestrator = new SearchOrchestrator({
          primaryProvider: primary,
          secondaryProvider: secondary,
          queryPlanner: new QueryPlanner(config.SEARCH_MAX_QUERIES_PER_JOB),
          maxConcurrent: config.SEARCH_MAX_CONCURRENT_REQUESTS,
          verifyInviteFn: verifyDiscordInvite,
          isSimulated: false,
        });
      } else {
        // Explicit Mock Mode using simulated adapter and deterministic verifier
        const mockPrimary = new MockSearchAdapter();
        orchestrator = new SearchOrchestrator({
          primaryProvider: mockPrimary,
          queryPlanner: new QueryPlanner(config.SEARCH_MAX_QUERIES_PER_JOB),
          maxConcurrent: config.SEARCH_MAX_CONCURRENT_REQUESTS,
          verifyInviteFn: verifyMockInvite,
          isSimulated: true,
        });
      }

      // Execute search orchestration
      const {
        results,
        progress,
        potentialLeads,
        dryRun,
        plannedQueries,
        estimatedRequests,
        estimatedCredits,
        dryRunExplanation,
        languageFilterNotice,
        providerUsage,
      } = await orchestrator.executeJob(job.params, async (currentProgress) => {
        await this.repo.updateJobProgress(jobId, currentProgress, 'running');
      });

      // Record provider usage only when NOT a dry run
      if (!dryRun) {
        if (job.mode === 'live') {
          // Record separate provider counts accurately
          const usage = providerUsage || {};
          let anyRecorded = false;
          for (const [providerName, reqCount] of Object.entries(usage)) {
            if (reqCount > 0) {
              await this.repo.recordProviderUsage(providerName, reqCount, reqCount);
              anyRecorded = true;
            }
          }
          if (!anyRecorded && progress.queriesAttempted > 0) {
            const fallbackProvider = config.SERPER_API_KEY ? 'serper' : 'tavily';
            await this.repo.recordProviderUsage(fallbackProvider, progress.queriesAttempted, progress.queriesAttempted);
          }
        } else {
          await this.repo.recordProviderUsage('mock', progress.queriesAttempted, 0);
        }
      }

      job.languageFilterNotice = languageFilterNotice;

      // Determine final status
      let finalStatus: SearchJob['status'] = 'completed';
      if (dryRun) {
        finalStatus = 'dry_run_plan';
        job.plannedQueries = plannedQueries;
        job.estimatedRequests = estimatedRequests;
        job.estimatedCredits = estimatedCredits;
        job.dryRunExplanation = dryRunExplanation;
      } else {
        const hasErrors = progress.providerErrors.length > 0;
        if (hasErrors) {
          if (results.length > 0) {
            finalStatus = 'partial';
          } else if (progress.queriesFailed >= progress.queriesAttempted && progress.queriesAttempted > 0) {
            finalStatus = 'failed';
            job.errorDetails = `All search providers failed: ${progress.providerErrors
              .map((e) => `[${e.provider}] ${e.error}`)
              .slice(0, 3)
              .join('; ')}`;
          }
        }
      }

      job.status = finalStatus;
      job.progress = progress;
      job.results = results;
      job.potentialLeads = potentialLeads;
      job.completedAt = new Date().toISOString();

      await this.repo.saveResults(jobId, results);
      await this.repo.saveJob(job);

      return job;
    } catch (err: any) {
      job.status = 'failed';
      job.errorDetails = err.message || 'Job execution encountered fatal error';
      job.completedAt = new Date().toISOString();
      await this.repo.saveJob(job);
      return job;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.repo.getJob(jobId);
    if (!job) return false;
    if (job.status === 'completed' || job.status === 'failed') return false;

    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    await this.repo.saveJob(job);
    return true;
  }
}

