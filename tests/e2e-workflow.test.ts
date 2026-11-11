import { describe, it, expect } from 'vitest';
import { InMemoryRepository, JobQueueManager } from '../packages/db/src/index.js';

describe('End-to-End Mock Workflow Integration', () => {
  it('runs complete discovery workflow from job submission to ranked results', async () => {
    const repo = new InMemoryRepository();
    const queue = new JobQueueManager(repo);

    // 1. Submit search job
    const job = await queue.createJob(
      {
        topics: ['forex', 'xauusd'],
        languages: ['en', 'de', 'ar'],
        limit: 5,
        depth: 1,
      },
      'integration-tester',
      'mock'
    );

    expect(job.status).toBe('queued');

    // 2. Execute background processing
    const completed = await queue.processJob(job.id);

    expect(completed.status).toBe('completed');
    expect(completed.isSimulated).toBe(true);
    expect(completed.progress.queriesExecuted).toBeGreaterThan(0);
    expect(completed.progress.invitesExtracted).toBeGreaterThan(0);
    expect(completed.progress.invitesVerified).toBeGreaterThan(0);
    expect(completed.progress.validInvitesFound).toBeGreaterThan(0);
    expect(completed.results.length).toBeGreaterThan(0);

    // 3. Inspect top result attributes
    const top = completed.results[0];
    expect(top.score).toBeGreaterThan(50);
    expect(top.invite.status).toBe('valid');
    expect(top.isSimulated).toBe(true);
    expect(top.scoreBreakdown.explanations.length).toBeGreaterThan(0);
    expect(top.invite.canonicalUrl).toMatch(/^https:\/\/discord\.gg\//);

    // 4. Verify results can be retrieved independently from repository (as web dashboard does)
    const storedResults = await repo.getJobResults(job.id);
    expect(storedResults.length).toBe(completed.results.length);
    expect(storedResults[0].invite.code).toBe(top.invite.code);
  });
});

