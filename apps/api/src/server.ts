import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import {
  getAllowedCorsOrigins,
  getConfig,
  getRedactedConfigSummary,
  getValidApiKeys,
} from '@discord-link-hunter/config';
import {
  canonicalizeDiscordInvite,
  compareRankedResults,
  DEFAULT_RESEARCH_SOURCES,
  getSelectableCountries,
  LanguageCode,
  matchesCountryFilter,
  type RankedInviteResult,
  type SearchJob,
  SUPPORTED_LANGUAGES,
  TradingTopic,
  TRADING_TOPICS,
  verifyDiscordInvite,
} from '@discord-link-hunter/core';
import {
  getRepository,
  JobQueueManager,
  LinkHunterRepository,
  testDatabaseConnection,
} from '@discord-link-hunter/db';

type ResultFilters = {
  newOnly?: string;
  minScore?: string;
  status?: string;
  topic?: string;
  language?: string;
  country?: string;
  platform?: string;
};

function filterResults(results: RankedInviteResult[], query: ResultFilters): RankedInviteResult[] {
  if (query.minScore) {
    const minScore = parseInt(query.minScore, 10);
    results = results.filter((r) => r.score >= minScore);
  }

  if (query.status) {
    if (query.status === 'valid') {
      results = results.filter((r) => r.invite.status === 'valid');
    } else if (query.status === 'expired_or_revoked') {
      results = results.filter((r) => r.invite.status !== 'valid');
    } else if (query.status !== 'all') {
      results = results.filter((r) => r.invite.status === query.status);
    }
  }

  if (query.topic) {
    results = results.filter((r) => r.detectedTopics.includes(query.topic as TradingTopic));
  }

  if (query.language) {
    results = results.filter((r) => r.detectedLanguage === query.language);
  }

  if (query.country) {
    results = results.filter((result) =>
      matchesCountryFilter(result.countryEvidence ?? result.invite.community?.countryEvidence, query.country),
    );
  }

  if (query.platform && query.platform !== 'all') {
    const target = query.platform.toLowerCase();
    results = results.filter((r) =>
      r.sources.some(
        (s) =>
          s.sourcePlatform?.toLowerCase() === target ||
          s.sourceDomain?.toLowerCase().includes(target)
      )
    );
  }

  return [...results].sort(compareRankedResults);
}

function csvCell(value: string | number | null | undefined): string {
  if (typeof value === 'number') return String(value);
  const text = value ?? '';
  const safe = /^[\t\r\n]|^\s*[=+@-]/u.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export interface ServerOptions {
  apiKey?: string;
  bypassAuth?: boolean;
}

export function buildServer(
  customRepo?: LinkHunterRepository,
  options?: ServerOptions
): FastifyInstance {
  const app = fastify({
    logger: false,
  });

  const config = getConfig();

  // CORS configuration
  app.register(cors, {
    origin: getAllowedCorsOrigins(),
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Rate limiting
  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  const repo = customRepo || getRepository();
  const queue = new JobQueueManager(repo);

  // Authentication preHandler hook for sensitive routes
  app.addHook('onRequest', async (req, reply) => {
    // Public endpoints
    const url = req.url.split('?')[0];
    if (url === '/health' || url === '/api/sources' || url === '/api/countries' || req.method === 'OPTIONS') {
      return;
    }

    // Bypass auth if specifically instructed in test options
    if (options?.bypassAuth) {
      return;
    }

    // Extract API key or Bearer token
    let token: string | null = null;
    const headerKey = req.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) {
      token = headerKey.trim();
    } else {
      const authHeader = req.headers['authorization'];
      if (typeof authHeader === 'string' && authHeader.trim()) {
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (match && match[1]) {
          token = match[1].trim();
        }
      }
    }

    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required. Provide an API key via x-api-key header or Authorization: Bearer <token>.',
      });
    }

    const validKeys = [
      ...(options?.apiKey ? [options.apiKey] : []),
      ...getValidApiKeys(),
    ];

    if (!validKeys.includes(token)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Invalid API key or authorization token.',
      });
    }
  });

  // Health check
  app.get('/health', async () => {
    const dbStatus = await testDatabaseConnection();
    return {
      status: 'ok',
      service: 'discord-link-hunter-api',
      mode: config.SEARCH_MODE,
      database: {
        connected: dbStatus.connected,
        usingMockRepo: repo.isMock,
        // Do not expose database hostnames or internal errors from a public check.
      },
      providers: {
        serper: Boolean(config.SERPER_API_KEY),
        tavily: Boolean(config.TAVILY_API_KEY),
      },
      config: getRedactedConfigSummary(),
      timestamp: new Date().toISOString(),
    };
  });

  // Create search job
  const CreateJobSchema = z.object({
    topics: z.array(z.enum(TRADING_TOPICS)).default(['forex', 'xauusd']),
    languages: z.array(z.enum(SUPPORTED_LANGUAGES)).default(['en']),
    country: z.string().trim().transform((value) => value.toUpperCase()).refine(
      (value) => value === '' || value === 'ALL' || getSelectableCountries().some(({ code }) => code === value),
      'Choose a selectable ISO country code or All Countries',
    ).transform((value) => value === '' || value === 'ALL' ? undefined : value).optional(),
    limit: z.number().int().min(1).max(50).default(10),
    depth: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10), z.literal(20)]).default(1),
    minMembers: z.number().int().nonnegative().optional(),
    dryRun: z.boolean().optional(),
    targetPlatforms: z.array(z.string().refine(
      (id) => DEFAULT_RESEARCH_SOURCES.some((source) => source.enabled && source.id === id),
      'Choose an available research platform',
    )).optional(),
    mode: z.enum(['mock', 'live']).optional(),
  });

  app.post('/api/jobs', async (req, reply) => {
    const parsed = CreateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid parameters', details: parsed.error.issues });
    }

    const params = parsed.data;
    const automatedTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    if (params.mode === 'mock' && !automatedTest) {
      return reply.status(400).send({ error: 'Simulated discovery mode is disabled.' });
    }
    const job = await queue.createJob(params, 'api-user', automatedTest ? params.mode : 'live');

    // Process job asynchronously without blocking HTTP response
    queue.processJob(job.id).catch((err) => {
      console.error(`[API] Background job ${job.id} error:`, err.message);
    });

    return reply.status(202).send({
      message: 'Search job queued successfully',
      jobId: job.id,
      mode: job.mode,
      params: job.params,
    });
  });

  // List recent jobs
  app.get('/api/jobs', async (req) => {
    const query = req.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const jobs = await repo.listJobs(limit);
    return { jobs };
  });

  // Get job details
  app.get('/api/jobs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await repo.getJob(id);
    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    return job;
  });

  // Irreversible job deletion: authenticated by the existing API request hook.
  app.delete('/api/jobs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { confirm?: boolean; jobId?: string };
    if (!id || id.length > 64 || body.confirm !== true || body.jobId !== id) {
      return reply.status(400).send({ error: 'Confirm deletion by supplying { confirm: true, jobId: <exact job ID> }.' });
    }
    const job = await repo.getJob(id);
    if (!job) return reply.status(404).send({ error: 'Job not found or already deleted.' });
    if (job.status === 'queued' || job.status === 'running') {
      return reply.status(409).send({ error: 'Finish or cancel the running job before deleting it.' });
    }
    try {
      const deleted = await repo.deleteJob(id);
      if (!deleted) return reply.status(404).send({ error: 'Job not found or already deleted.' });
      return reply.status(200).send({ deleted: true, jobId: id });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      if (message.startsWith('Cannot delete a queued or running job')) {
        return reply.status(409).send({ error: message });
      }
      req.log.error({ err: error }, 'Failed to delete job');
      return reply.status(500).send({ error: 'Unable to delete job. No deletion was confirmed.' });
    }
  });

  // Cancel job
  app.post('/api/jobs/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    const success = await queue.cancelJob(id);
    if (!success) {
      return reply.status(400).send({ error: 'Cannot cancel job (either not found or already ended)' });
    }
    return { message: 'Job cancelled successfully' };
  });

  // Execute a Dry Run plan with confirmation & usage limit checks
  app.post('/api/jobs/:id/execute', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body as any) || {};

    if (body.confirm !== true) {
      return reply.status(400).send({
        error: 'Explicit confirmation required. Send { "confirm": true } to proceed with live execution.',
      });
    }

    const job = await repo.getJob(id);
    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    if (job.mode === 'mock' && process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
      return reply.status(400).send({ error: 'Historical simulated plans cannot be executed in Live Mode.' });
    }

    // Check usage limits if in live mode
    if (job.mode === 'live') {
      const stats = await repo.getProviderStats();
      const currentRequests = (stats.serper?.requests || 0) + (stats.tavily?.requests || 0);
      const plannedCost = job.estimatedRequests || 1;
      if (currentRequests + plannedCost > config.SEARCH_DAILY_PROVIDER_REQUEST_CAP) {
        return reply.status(429).send({
          error: `Execution blocked: Daily provider request cap would be exceeded (${currentRequests}/${config.SEARCH_DAILY_PROVIDER_REQUEST_CAP} requests).`,
        });
      }
    }

    // Create an executed job with dryRun: false
    const executeParams = {
      ...job.params,
      dryRun: false,
    };

    const newJob = await queue.createJob(executeParams, job.ownerId || 'api-user', job.mode);

    // Process asynchronously
    queue.processJob(newJob.id).catch((err) => {
      console.error(`[API] Executed job ${newJob.id} error:`, err.message);
    });

    return reply.status(202).send({
      message: 'Plan confirmed: search execution launched successfully',
      jobId: newJob.id,
      mode: newJob.mode,
      params: newJob.params,
    });
  });

  // Recover abandoned jobs after an unexpected server crash
  app.post('/api/jobs/recover', async () => {
    const recovery = await queue.recoverAbandonedJobs({ olderThanMs: 30 * 60 * 1000 });
    return {
      message: `Recovered ${recovery.recoveredCount} abandoned job(s)`,
      ...recovery,
    };
  });

  // Get configurable research sources
  app.get('/api/sources', async () => {
    return { sources: DEFAULT_RESEARCH_SOURCES };
  });

  // Get selectable non-African countries
  app.get('/api/countries', async () => {
    return { countries: getSelectableCountries() };
  });

  // Get job results with filtering
  async function filterNew(job: SearchJob | null, results: RankedInviteResult[], query: ResultFilters) {
    if (!job || query.newOnly !== 'true') return results;
    const seen = await repo.getPreviouslySeen(job, results);
    return results.filter(({ invite }) =>
      !seen.has(invite.community?.id ? 'guild:' + invite.community.id : 'invite:' + invite.code));
  }

  app.get('/api/results/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as ResultFilters;

    let results = await repo.getJobResults(id);
    const job = await repo.getJob(id);
    const totalStored = results.length;
    const inactiveCount = results.filter((r) => r.invite.status !== 'valid').length;
    const activeStoredCount = totalStored - inactiveCount;

    results = await filterNew(job, filterResults(results, query), query);
    const countryUnconfirmed = query.country && query.country !== 'all' ? [] :
      await filterNew(job, filterResults(job?.progress.countryUnconfirmed ?? [], query), query);

    let potentialLeads = job?.potentialLeads || [];
    if (query.platform && query.platform !== 'all') {
      const target = query.platform.toLowerCase();
      potentialLeads = potentialLeads.filter(
        (lead) =>
          lead.sourcePlatform.toLowerCase() === target ||
          lead.sourceDomain.toLowerCase().includes(target)
      );
    }

    return {
      jobId: id,
      count: results.length,
      totalCount: totalStored,
      excludedCount: totalStored - results.length,
      inactiveCount,
      activeStoredCount,
      results,
      potentialLeads,
      countryUnconfirmed,
    };
  });

  // Export results as CSV or JSON
  app.get('/api/export/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as ResultFilters & { format?: string };
    const format = query.format === 'csv' ? 'csv' : 'json';

    const job = query.newOnly === 'true' ? await repo.getJob(id) : null;
    const results = await filterNew(job, filterResults(await repo.getJobResults(id), query), query);

    if (format === 'csv') {
      const headers = [
        'Score',
        'Canonical URL',
        'Status',
        'Server Name',
        'Members',
        'Language',
        'Country Code',
        'Country Name',
        'Country Status',
        'Topics',
        'Verified Date',
        'Country Evidence URL',
        'Country Evidence',
        'Country Evidence Timestamp',
        'Original Source URLs',
      ];
      const rows = results.map((r) => {
        const cEv = r.countryEvidence || r.invite.community?.countryEvidence;
        return [
          r.score,
          r.invite.canonicalUrl,
          r.invite.status,
          r.invite.community?.name,
          r.invite.community?.approximateMemberCount,
          r.detectedLanguage,
          cEv?.countryCode,
          cEv?.countryName,
          cEv?.status ?? 'unknown',
          r.detectedTopics.join(', '),
          r.invite.lastVerifiedAt,
          cEv?.sourceUrl,
          cEv?.supportingEvidence,
          cEv?.lastVerifiedAt,
          r.sources.map(({ sourceUrl }) => sourceUrl).filter(Boolean).join(' | '),
        ].map(csvCell);
      });

      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="job-${id}-results.csv"`);
      return reply.send(csvContent);
    }

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="job-${id}-results.json"`);
    return reply.send(results);
  });

  // Verify single Discord invite
  app.post('/api/verify', async (req, reply) => {
    const { url } = (req.body as { url?: string }) || {};
    if (!url) {
      return reply.status(400).send({ error: 'Invite URL is required' });
    }

    const canonical = canonicalizeDiscordInvite(url);
    if (!canonical) {
      return reply.status(400).send({ error: 'Invalid Discord invite format' });
    }

    const verified = await verifyDiscordInvite(canonical.code);
    return verified;
  });

  // Provider usage statistics
  app.get('/api/usage', async () => {
    const stats = await repo.getProviderStats();
    return stats;
  });

  return app;
}

