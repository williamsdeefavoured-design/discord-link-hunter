import { describe, it, expect } from 'vitest';
import { InMemoryRepository, JobQueueManager } from '../packages/db/src/index.js';

describe('Database Repositories & Job Queue State Machine', () => {
  it('manages job lifecycle: queued -> running -> completed', async () => {
    const repo = new InMemoryRepository();
    const queue = new JobQueueManager(repo);

    const job = await queue.createJob(
      {
        topics: ['crypto'],
        languages: ['en'],
        limit: 5,
        depth: 1,
      },
      'tester',
      'mock'
    );

    expect(job.status).toBe('queued');

    const processed = await queue.processJob(job.id);
    expect(processed.status).toBe('completed');
    expect(processed.results.length).toBeGreaterThan(0);
    expect(processed.completedAt).toBeDefined();

    const retrieved = await repo.getJob(job.id);
    expect(retrieved?.status).toBe('completed');
  });

  it('allows cancelling an active or queued job', async () => {
    const repo = new InMemoryRepository();
    const queue = new JobQueueManager(repo);

    const job = await queue.createJob(
      {
        topics: ['forex'],
        languages: ['de'],
        limit: 5,
        depth: 1,
      },
      'tester',
      'mock'
    );

    const cancelled = await queue.cancelJob(job.id);
    expect(cancelled).toBe(true);

    const retrieved = await repo.getJob(job.id);
    expect(retrieved?.status).toBe('cancelled');
  });

  it('tracks provider request counts and credits accurately', async () => {
    const repo = new InMemoryRepository();
    const beforeStats = await repo.getProviderStats();
    const initialRequests = beforeStats.serper?.requests || 0;
    const initialCredits = beforeStats.serper?.credits || 0;
    const initialErrors = beforeStats.serper?.errors || 0;

    await repo.recordProviderUsage('serper', 3, 3);
    await repo.recordProviderUsage('serper', 2, 2, 'Rate limited');

    const stats = await repo.getProviderStats();
    expect(stats.serper.requests).toBe(initialRequests + 5);
    expect(stats.serper.credits).toBe(initialCredits + 5);
    expect(stats.serper.errors).toBe(initialErrors + 1);
  });
});

