import { getConfig } from '@discord-link-hunter/config';
import { createBotClient } from './client.js';
import { handleInteraction } from './commands.js';

const config = getConfig();

if (!config.DISCORD_TOKEN) {
  console.error('[Bot] DISCORD_TOKEN is not configured. Bot cannot start in live mode.');
  console.log('[Bot] Please configure DISCORD_TOKEN in .env or run in mock mode.');
  process.exit(1);
}

const client = createBotClient();

client.once('ready', (c) => {
  console.log(`[Bot] Logged in successfully as ${c.user.tag}!`);
  console.log(`[Bot] Ready to process commands in guild ${config.DISCORD_GUILD_ID}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleInteraction(interaction);
  } catch (err: any) {
    console.error(`[Bot] Error executing command ${interaction.commandName}:`, err);
    const replyContent = {
      content: '⚠️ An unexpected error occurred while processing this command.',
      ephemeral: true,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(replyContent).catch(() => {});
    } else {
      await interaction.reply(replyContent).catch(() => {});
    }
  }
});

client.login(config.DISCORD_TOKEN).catch((err) => {
  console.error('[Bot] Failed to login to Discord Gateway:', err.message);
  process.exit(1);
});

