import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { getConfig, getRedactedConfigSummary } from '@discord-link-hunter/config';
import {
  canonicalizeDiscordInvite,
  compareRankedResults,
  LanguageCode,
  SUPPORTED_LANGUAGES,
  TradingTopic,
  TRADING_TOPICS,
  verifyDiscordInvite,
} from '@discord-link-hunter/core';
import {
  getRepository,
  JobQueueManager,
  testDatabaseConnection,
} from '@discord-link-hunter/db';

export function buildServer(): FastifyInstance {
  const app = fastify({
    logger: false,
  });

  const config = getConfig();

  // CORS configuration
  app.register(cors, {
    origin: [config.WEB_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Rate limiting
  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  const repo = getRepository();
  const queue = new JobQueueManager(repo);

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
        endpoint: dbStatus.endpoint,
        error: dbStatus.error,
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
    limit: z.number().int().min(1).max(50).default(10),
    depth: z.number().int().min(1).max(2).default(1),
    minMembers: z.number().int().optional(),
    dryRun: z.boolean().optional(),
    mode: z.enum(['mock', 'live']).optional(),
  });

  app.post('/api/jobs', async (req, reply) => {
    const parsed = CreateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid parameters', details: parsed.error.issues });
    }

    const params = parsed.data;
    const job = await queue.createJob(params, 'api-user', params.mode);

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

    // Check usage limits if in live mode
    if (job.mode === 'live') {
      const stats = await repo.getProviderStats();
      const currentRequests = stats.serper?.requests || stats.tavily?.requests || 0;
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

  // Get job results with filtering
  app.get('/api/results/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as {
      minScore?: string;
      status?: string;
      topic?: string;
      language?: string;
    };

    let results = await repo.getJobResults(id);

    if (query.minScore) {
      const minScore = parseInt(query.minScore, 10);
      results = results.filter((r) => r.score >= minScore);
    }

    if (query.status) {
      results = results.filter((r) => r.invite.status === query.status);
    }

    if (query.topic) {
      results = results.filter((r) => r.detectedTopics.includes(query.topic as TradingTopic));
    }

    if (query.language) {
      results = results.filter((r) => r.detectedLanguage === query.language);
    }

    results.sort(compareRankedResults);

    return { jobId: id, count: results.length, results };
  });

  // Export results as CSV or JSON
  app.get('/api/export/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { format?: string };
    const format = query.format === 'csv' ? 'csv' : 'json';

    const results = await repo.getJobResults(id);

    if (format === 'csv') {
      const headers = [
        'Score',
        'Canonical URL',
        'Status',
        'Server Name',
        'Members',
        'Language',
        'Topics',
        'Verified Date',
      ];
      const rows = results.map((r) => [
        r.score,
        `"${r.invite.canonicalUrl}"`,
        `"${r.invite.status}"`,
        `"${(r.invite.community?.name || '').replace(/"/g, '""')}"`,
        r.invite.community?.approximateMemberCount || 0,
        `"${r.detectedLanguage}"`,
        `"${r.detectedTopics.join(', ')}"`,
        `"${r.invite.lastVerifiedAt}"`,
      ]);

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

