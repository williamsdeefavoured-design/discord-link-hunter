import { describe, it, expect, vi } from 'vitest';
import { SearchOrchestrator } from '../packages/research/src/orchestrator.js';
import { QueryPlanner } from '../packages/research/src/query-planner.js';
import { buildServer } from '../apps/api/src/server.js';
import { getRepository, JobQueueManager } from '../packages/db/src/index.js';

describe('Dry Run Engine & API Guarantees', () => {
  it('proves Dry Run performs ZERO external calls (Serper, Tavily, Discord API, Gemini)', async () => {
    const serperSearchSpy = vi.fn();
    const tavilySearchSpy = vi.fn();
    const discordVerifySpy = vi.fn();

    const mockPrimary = {
      name: 'serper' as const,
      isAvailable: () => true,
      getDailyRequestCount: () => 0,
      search: serperSearchSpy,
    };

    const mockSecondary = {
      name: 'tavily' as const,
      isAvailable: () => true,
      getDailyRequestCount: () => 0,
      search: tavilySearchSpy,
    };

    const orchestrator = new SearchOrchestrator({
      primaryProvider: mockPrimary as any,
      secondaryProvider: mockSecondary as any,
      queryPlanner: new QueryPlanner(10),
      verifyInviteFn: discordVerifySpy as any,
    });

    const outcome = await orchestrator.executeJob({
      topics: ['forex', 'xauusd'],
      languages: ['en', 'ar'],
      limit: 10,
      depth: 1,
      dryRun: true,
    });

    // CRITICAL: Absolute verification that zero external requests were made
    expect(serperSearchSpy).toHaveBeenCalledTimes(0);
    expect(tavilySearchSpy).toHaveBeenCalledTimes(0);
    expect(discordVerifySpy).toHaveBeenCalledTimes(0);

    // Plan & estimates must be generated
    expect(outcome.dryRun).toBe(true);
    expect(outcome.results.length).toBe(0);
    expect(outcome.progress.queriesExecuted).toBe(0);
    expect(outcome.progress.urlsDiscovered).toBe(0);
    expect(outcome.progress.invitesChecked).toBe(0);
    expect(outcome.progress.validInvites).toBe(0);

    expect(outcome.plannedQueries).toBeDefined();
    expect(outcome.plannedQueries!.length).toBeGreaterThan(0);
    expect(outcome.estimatedRequests).toBeGreaterThan(0);
    expect(outcome.estimatedCredits).toBeGreaterThan(0);
    expect(outcome.dryRunExplanation).toContain('Dry Run');
  });

  it('marks job status strictly as dry_run_plan in JobQueueManager', async () => {
    const repo = getRepository();
    const queue = new JobQueueManager(repo);

    const job = await queue.createJob(
      {
        topics: ['crypto'],
        languages: ['en'],
        limit: 5,
        depth: 1,
        dryRun: true,
      },
      'test-dry-runner',
      'mock'
    );

    expect(job.status).toBe('queued');

    const completed = await queue.processJob(job.id);

    // Must be labeled 'dry_run_plan', not ordinary 'completed'
    expect(completed.status).toBe('dry_run_plan');
    expect(completed.plannedQueries?.length).toBeGreaterThan(0);
    expect(completed.estimatedRequests).toBeGreaterThan(0);
    expect(completed.estimatedCredits).toBeGreaterThan(0);
    expect(completed.results.length).toBe(0);
  });

  it('enforces explicit user confirmation on /api/jobs/:id/execute', async () => {
    const app = buildServer();
    const repo = getRepository();
    const queue = new JobQueueManager(repo);

    // 1. Create a dry-run job
    const dryJob = await queue.createJob(
      {
        topics: ['forex'],
        languages: ['en'],
        limit: 5,
        depth: 1,
        dryRun: true,
      },
      'api-dry-user',
      'mock'
    );
    await queue.processJob(dryJob.id);

    // 2. Attempt to execute without confirmation flag
    const unconfirmedRes = await app.inject({
      method: 'POST',
      url: `/api/jobs/${dryJob.id}/execute`,
      headers: { 'x-api-key': 'dlh_dev_secret_key' },
      payload: {},
    });

    expect(unconfirmedRes.statusCode).toBe(400);
    const unconfirmedData = JSON.parse(unconfirmedRes.payload);
    expect(unconfirmedData.error).toContain('Explicit confirmation required');

    // 3. Execute with explicit confirmation { confirm: true }
    const confirmedRes = await app.inject({
      method: 'POST',
      url: `/api/jobs/${dryJob.id}/execute`,
      headers: { 'x-api-key': 'dlh_dev_secret_key' },
      payload: { confirm: true },
    });

    expect(confirmedRes.statusCode).toBe(202);
    const confirmedData = JSON.parse(confirmedRes.payload);
    expect(confirmedData.message).toContain('Plan confirmed');
    expect(confirmedData.jobId).toBeDefined();
    expect(confirmedData.params.dryRun).toBe(false);
  });
});
