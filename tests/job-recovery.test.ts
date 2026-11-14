import { describe, it, expect } from 'vitest';
import { InMemoryRepository, JobQueueManager } from '../packages/db/src/index.js';
import { SearchJob } from '../packages/core/src/index.js';

describe('Phase 2 — Job Recovery & Duplicate Execution Prevention', () => {
  it('detects and recovers jobs abandoned in running state after an unexpected crash', async () => {
    const repo = new InMemoryRepository();
    const queue = new JobQueueManager(repo);

    // 1. Simulate a job left in 'running' state after a server crash
    const abandonedJob: SearchJob = {
      id: 'job-crashed-101',
      params: { topics: ['forex'], languages: ['en'], limit: 5, depth: 1 },
      mode: 'mock',
      status: 'running',
      startedAt: new Date(Date.now() - 60000).toISOString(),
      createdAt: new Date(Date.now() - 65000).toISOString(),
      progress: {
        queriesPlanned: 4,
        queriesAttempted: 2,
        queriesSuccessful: 2,
        queriesFailed: 0,
        urlsDiscovered: 4,
        invitesExtracted: 2,
        uniqueInvites: 2,
        invitesChecked: 1,
        validInvites: 1,
        invalidInvites: 0,
        restrictedOrUnverified: 0,
        queriesExecuted: 2,
        invitesVerified: 1,
        validInvitesFound: 1,
        providerErrors: [],
      },
      results: [],
    };
    await repo.saveJob(abandonedJob);

    // 2. Perform crash recovery scan
    const recoveryResult = await queue.recoverAbandonedJobs({ olderThanMs: 0 });

    expect(recoveryResult.recoveredCount).toBeGreaterThanOrEqual(1);
    expect(recoveryResult.jobIds).toContain('job-crashed-101');

    // 3. Verify recovered job state in persistence
    const updated = await repo.getJob('job-crashed-101');
    expect(updated?.status).toBe('failed');
    expect(updated?.errorDetails).toContain('unexpected server restart or process termination');
    expect(updated?.completedAt).toBeDefined();
  });

  it('preserves completed and dry-run jobs without altering their status', async () => {
    const repo = new InMemoryRepository();
    const queue = new JobQueueManager(repo);

    const completedJob: SearchJob = {
      id: 'job-completed-201',
      params: { topics: ['crypto'], languages: ['en'], limit: 5, depth: 1 },
      mode: 'mock',
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      progress: {
        queriesPlanned: 2,
        queriesAttempted: 2,
        queriesSuccessful: 2,
        queriesFailed: 0,
        urlsDiscovered: 5,
        invitesExtracted: 3,
        uniqueInvites: 3,
        invitesChecked: 3,
        validInvites: 3,
        invalidInvites: 0,
        restrictedOrUnverified: 0,
        queriesExecuted: 2,
        invitesVerified: 3,
        validInvitesFound: 3,
        providerErrors: [],
      },
      results: [],
    };

    const dryRunJob: SearchJob = {
      id: 'job-dryrun-202',
      params: { topics: ['stocks'], languages: ['en'], limit: 5, depth: 1, dryRun: true },
      mode: 'mock',
      status: 'dry_run_plan',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      progress: {
        queriesPlanned: 3,
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
    };

    await repo.saveJob(completedJob);
    await repo.saveJob(dryRunJob);

    // Run recovery
    const recovery = await queue.recoverAbandonedJobs({ olderThanMs: 0 });
    expect(recovery.recoveredCount).toBe(0);

    const checkCompleted = await repo.getJob('job-completed-201');
    expect(checkCompleted?.status).toBe('completed');

    const checkDryRun = await repo.getJob('job-dryrun-202');
    expect(checkDryRun?.status).toBe('dry_run_plan');
  });

  it('does not re-execute already completed or dry-run jobs when processJob is invoked', async () => {
    const repo = new InMemoryRepository();
    const queue = new JobQueueManager(repo);

    const completedJob: SearchJob = {
      id: 'job-frozen-301',
      params: { topics: ['xauusd'], languages: ['en'], limit: 5, depth: 1 },
      mode: 'mock',
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      progress: {
        queriesPlanned: 1,
        queriesAttempted: 1,
        queriesSuccessful: 1,
        queriesFailed: 0,
        urlsDiscovered: 2,
        invitesExtracted: 1,
        uniqueInvites: 1,
        invitesChecked: 1,
        validInvites: 1,
        invalidInvites: 0,
        restrictedOrUnverified: 0,
        queriesExecuted: 1,
        invitesVerified: 1,
        validInvitesFound: 1,
        providerErrors: [],
      },
      results: [],
    };
    await repo.saveJob(completedJob);

    // Call processJob on already-completed job
    const result = await queue.processJob('job-frozen-301');
    expect(result.status).toBe('completed');
    expect(result.id).toBe('job-frozen-301');
  });

  it('prevents concurrent duplicate executions of the same job', async () => {
    const repo = new InMemoryRepository();
    const queue = new JobQueueManager(repo);

    const job = await queue.createJob(
      { topics: ['forex'], languages: ['en'], limit: 3, depth: 1 },
      'user-concurrent',
      'mock'
    );

    // Trigger processJob concurrently twice
    const [runA, runB] = await Promise.all([
      queue.processJob(job.id),
      queue.processJob(job.id),
    ]);

    expect(runA.id).toBe(job.id);
    expect(runB.id).toBe(job.id);
    expect(runA.status).toBe('completed');
    expect(runB.status).toBe('completed');
  });
});
