import { getConfig } from '../packages/config/src/index.js';
import { SerperAdapter } from '../packages/research/src/serper.js';
import { extractDiscordInvites, verifyDiscordInvite } from '../packages/core/src/invite.js';

async function runLiveSmoke() {
  console.log('\n=============================================');
  console.log('⚡ BOUNDED LIVE SMOKE TEST (TINY QUOTA)');
  console.log('=============================================\n');

  const config = getConfig();

  if (!config.SERPER_API_KEY) {
    console.log('⚠️ Serper API key is not configured in .env. Skipping live search test.');
    return;
  }

  console.log('1. Executing 1 bounded search via Serper (query: "forex trading discord.gg")...');
  const serper = new SerperAdapter(config.SERPER_API_KEY, 5);

  const result = await serper.search('forex trading "discord.gg/"', { limit: 3 });

  console.log(`   Status Code: ${result.statusCode}`);
  console.log(`   Items Found: ${result.items.length}`);
  console.log(`   Credit Used: ${result.creditCost || 1}`);

  if (result.error) {
    console.error(`   Error details: ${result.error}`);
    return;
  }

  console.log('\n2. Extracting Discord invite candidates from search results...');
  const combinedText = result.items.map((i) => `${i.title}\n${i.snippet}\n${i.url}`).join('\n');
  const invites = extractDiscordInvites(combinedText, undefined, 'serper');

  console.log(`   Extracted ${invites.length} candidate invite codes.`);

  if (invites.length > 0) {
    const candidate = invites[0];
    console.log(`\n3. Verifying first candidate: ${candidate.canonicalUrl}...`);
    const verified = await verifyDiscordInvite(candidate.code);
    console.log(`   Status:       ${verified.status}`);
    console.log(`   Server Name:  ${verified.community?.name || 'N/A'}`);
    console.log(`   Member Count: ${verified.community?.approximateMemberCount || 'N/A'}`);
  }

  console.log('\n✅ BOUNDED LIVE TEST COMPLETED.\n');
}

runLiveSmoke().catch((err) => {
  console.error('❌ LIVE SMOKE TEST ENCOUNTERED AN ERROR:', err.message);
});

