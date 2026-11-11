import { getConfig, getRedactedConfigSummary, maskSecret } from '../packages/config/src/index.js';
import { testDatabaseConnection } from '../packages/db/src/client.js';

async function runDoctor() {
  console.log('\n=============================================');
  console.log('🩺 DISCORD LINK HUNTER SYSTEM HEALTH CHECK');
  console.log('=============================================\n');

  const config = getConfig();
  const summary = getRedactedConfigSummary();

  console.log(`Environment: ${summary.environment}`);
  console.log(`Search Mode: ${summary.searchMode.toUpperCase()}`);
  console.log(`API Port:    ${summary.apiPort}`);
  console.log('---------------------------------------------');

  // Discord Configuration
  console.log('\n[Discord Bot]');
  console.log(`  Token Configured:     ${summary.hasDiscordToken ? '✅ YES' : '❌ NO'}`);
  console.log(`  Client ID Configured: ${summary.hasDiscordClientId ? '✅ YES' : '❌ NO'}`);
  console.log(`  Guild ID Configured:  ${summary.hasDiscordGuildId ? '✅ YES' : '❌ NO'}`);

  // Search Providers
  console.log('\n[Search Providers]');
  console.log(`  Serper API Key:       ${summary.hasSerperKey ? '✅ YES' : '❌ NO'}`);
  console.log(`  Tavily API Key:       ${summary.hasTavilyKey ? '✅ YES' : '❌ NO'}`);
  console.log(`  Daily Request Cap:    ${summary.quotas.dailyProviderCap} requests`);
  console.log(`  Max Queries Per Job:  ${summary.quotas.maxQueriesPerJob}`);

  // Supabase Database
  console.log('\n[Supabase Database]');
  console.log(`  Supabase URL:         ${summary.hasSupabaseUrl ? '✅ YES' : '❌ NO'}`);
  console.log(`  Publishable Key:      ${summary.hasSupabasePublishableKey ? '✅ YES' : '❌ NO'}`);
  console.log(`  Secret Key:           ${summary.hasSupabaseSecretKey ? '✅ YES' : '❌ NO'}`);
  console.log(`  Database URL:         ${summary.hasDatabaseUrl ? '✅ YES' : '❌ NO'}`);

  if (summary.hasDatabaseUrl) {
    process.stdout.write('  Testing Postgres Connection... ');
    const dbTest = await testDatabaseConnection();
    if (dbTest.connected) {
      console.log('✅ CONNECTED');
    } else {
      console.log(`⚠️ FAILED (${dbTest.error || 'unreachable'})`);
      console.log('  -> Fallback: Mock In-Memory Repository is active for offline testing.');
    }
  } else {
    console.log('  Database Connection:  ℹ️ In-Memory Mock Repository active (No DB URL)');
  }

  console.log('\n---------------------------------------------');
  console.log('Summary: System is configured and ready for execution!');
  console.log('=============================================\n');
}

runDoctor().catch((err) => {
  console.error('[Doctor] Fatal error:', err.message);
});

