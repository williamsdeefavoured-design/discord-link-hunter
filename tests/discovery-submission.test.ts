import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../apps/api/src/server.js';
import { FastifyInstance } from 'fastify';
import { getRepository, JobQueueManager } from '../packages/db/src/index.js';

describe('Discovery Submission & Dry Run Verification', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('submits Mock Mode + Dry Run job and receives 202 JSON with dryRun: true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        topics: ['forex', 'xauusd'],
        languages: ['en'],
        limit: 10,
        depth: 1,
        mode: 'mock',
        dryRun: true,
      },
    });

    expect(res.statusCode).toBe(202);
    expect(res.headers['content-type']).toContain('application/json');

    const data = JSON.parse(res.payload);
    expect(data.message).toBe('Search job queued successfully');
    expect(data.jobId).toBeDefined();
    expect(data.mode).toBe('mock');
    expect(data.params.dryRun).toBe(true);
    expect(data.params.topics).toEqual(['forex', 'xauusd']);

    // Check that job queue executed without external provider credit spend
    const repo = getRepository();
    const queue = new JobQueueManager(repo);
    const completed = await queue.processJob(data.jobId);

    expect(completed.status).toBe('dry_run_plan');
    expect(completed.results.length).toBe(0); // Dry run produces no live results
    expect(completed.progress.queriesExecuted).toBe(0); // Zero queries executed in dry run
    expect(completed.plannedQueries?.length).toBeGreaterThan(0);
    expect(completed.estimatedRequests).toBeGreaterThan(0);
    expect(completed.dryRunExplanation).toBeDefined();
  });

  it('submits Mock Mode (non-dry-run) and produces ranked results from fixtures', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        topics: ['forex'],
        languages: ['en'],
        limit: 5,
        depth: 1,
        mode: 'mock',
        dryRun: false,
      },
    });

    expect(res.statusCode).toBe(202);
    const data = JSON.parse(res.payload);
    expect(data.jobId).toBeDefined();

    const repo = getRepository();
    const queue = new JobQueueManager(repo);
    const completed = await queue.processJob(data.jobId);

    expect(completed.status).toBe('completed');
    expect(completed.results.length).toBeGreaterThan(0);
    expect(completed.results[0].score).toBeGreaterThan(0);
    expect(completed.progress.queriesExecuted).toBeGreaterThan(0);
  });

  it('rejects invalid parameters with HTTP 400 and valid JSON error details', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        topics: ['invalid-topic-xyz'],
        limit: -5,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/json');

    const data = JSON.parse(res.payload);
    expect(data.error).toBe('Invalid parameters');
    expect(Array.isArray(data.details)).toBe(true);
  });
});

