import { MockSearchAdapter, QueryPlanner, SearchOrchestrator } from '../packages/research/src/index.js';
import { InMemoryRepository, JobQueueManager } from '../packages/db/src/index.js';

async function runMockSmoke() {
  console.log('\n=============================================');
  console.log('🧪 RUNNING END-TO-END MOCK SMOKE TEST');
  console.log('=============================================\n');

  const repo = new InMemoryRepository();
  const queue = new JobQueueManager(repo);

  console.log('1. Creating mock discovery job for [forex, xauusd] in [en, de]...');
  const job = await queue.createJob(
    {
      topics: ['forex', 'xauusd'],
      languages: ['en', 'de'],
      limit: 5,
      depth: 1,
    },
    'smoke-test-runner',
    'mock'
  );

  console.log(`   Created Job ID: ${job.id} (Status: ${job.status})`);

  console.log('2. Processing mock discovery pipeline...');
  const completedJob = await queue.processJob(job.id);

  console.log(`   Job Finished with Status: ${completedJob.status}`);
  console.log(`   Queries Executed:        ${completedJob.progress.queriesExecuted}`);
  console.log(`   Invites Discovered:      ${completedJob.progress.invitesExtracted}`);
  console.log(`   Invites Verified:        ${completedJob.progress.invitesVerified}`);
  console.log(`   Ranked Results Count:    ${completedJob.results.length}`);

  if (completedJob.results.length === 0) {
    throw new Error('Smoke test failed: No ranked results produced');
  }

  console.log('\n3. Top Ranked Mock Result:');
  const top = completedJob.results[0];
  console.log(`   Score:      ${top.score}/100`);
  console.log(`   Link:       ${top.invite.canonicalUrl}`);
  console.log(`   Community:  ${top.invite.community?.name}`);
  console.log(`   Members:    ${top.invite.community?.approximateMemberCount}`);
  console.log(`   Language:   ${top.detectedLanguage}`);
  console.log(`   Topics:     ${top.detectedTopics.join(', ')}`);
  console.log(`   Status:     ${top.invite.status}`);

  console.log('\n✅ MOCK SMOKE TEST PASSED SUCCESSFULLY!\n');
}

runMockSmoke().catch((err) => {
  console.error('❌ MOCK SMOKE TEST FAILED:', err);
  process.exit(1);
});

