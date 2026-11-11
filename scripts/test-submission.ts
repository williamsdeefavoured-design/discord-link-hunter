import { buildServer } from '../apps/api/src/server.js';

async function main() {
  console.log('\n--- Verifying Discovery Job Submission End-to-End ---');
  const app = buildServer();
  await app.ready();

  console.log('1. Submitting Mock Mode + Dry Run discovery job...');
  const res = await app.inject({
    method: 'POST',
    url: '/api/jobs',
    payload: {
      topics: ['forex', 'xauusd'],
      languages: ['en'],
      limit: 5,
      depth: 1,
      mode: 'mock',
      dryRun: true,
    },
  });

  console.log(`   HTTP Status: ${res.statusCode} (Expected 202)`);
  console.log(`   Content-Type: ${res.headers['content-type']}`);

  if (res.statusCode !== 202) {
    throw new Error(`Expected HTTP 202 but got ${res.statusCode}: ${res.payload}`);
  }

  const data = JSON.parse(res.payload);
  console.log(`   Job ID Created: ${data.jobId}`);
  console.log(`   Mode: ${data.mode}`);
  console.log(`   Dry Run: ${data.params.dryRun}`);

  console.log('2. Querying Job Status via GET /api/jobs/:id ...');
  // Wait brief moment for background job queue
  await new Promise((r) => setTimeout(r, 500));

  const statusRes = await app.inject({
    method: 'GET',
    url: `/api/jobs/${data.jobId}`,
  });

  console.log(`   Status HTTP: ${statusRes.statusCode}`);
  const jobStatus = JSON.parse(statusRes.payload);
  console.log(`   Job State: ${jobStatus.status}`);
  console.log(`   Queries Planned: ${jobStatus.progress.queriesPlanned}`);
  console.log(`   Queries Executed: ${jobStatus.progress.queriesExecuted} (0 for dry-run)`);
  console.log(`   Provider Errors: ${jobStatus.progress.providerErrors.length}`);

  await app.close();
  console.log('✅ End-to-end discovery submission verified successfully!\n');
}

main().catch((err) => {
  console.error('❌ Discovery submission test failed:', err);
  process.exit(1);
});

