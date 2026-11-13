
import { Events } from 'discord.js';

import { getConfig } from '@discord-link-hunter/config';

import {
  getRepository,
  testDatabaseConnection,
} from '@discord-link-hunter/db';

import { createBotClient } from './client.js';
import { handleInteraction } from './commands.js';

/**
 * Discord Link Hunter
 * Bot initialization and startup
 */

async function startBot() {
  const config = getConfig();

  // STEP 1: Validate Discord credentials
  if (!config.DISCORD_TOKEN) {
    throw new Error(
      '[Bot] DISCORD_TOKEN is not configured.'
    );
  }

  // STEP 2: Confirm database configuration
  const databaseConfigured = Boolean(
    config.DATABASE_URL || config.DIRECT_URL
  );

  if (!databaseConfigured) {
    throw new Error(
      '[Bot] PostgreSQL connection is not configured.'
    );
  }

  // STEP 3: Verify the database before accepting commands
  console.log('[Bot] Checking PostgreSQL connection...');

  const dbStatus = await testDatabaseConnection();

  if (!dbStatus.connected) {
    throw new Error(
      `[Bot] Database connection failed: ${
        dbStatus.error || 'Unknown connection error'
      }`
    );
  }

  console.log('[Bot] PostgreSQL connection verified.');

  // STEP 4: Initialize the shared repository
  const repo = getRepository();

  if (repo.isMock) {
    throw new Error(
      '[Bot] Unexpected in-memory repository. ' +
      'PostgreSQL persistence is required.'
    );
  }

  // Confirm the search_jobs table can be queried
  await repo.listJobs(1);

  console.log('[Bot] Supabase repository initialized.');

  // STEP 5: Create Discord client
  const client = createBotClient();

  // Use the supported Discord.js ready event
  client.once(Events.ClientReady, (readyClient) => {
    console.log(
      `[Bot] Logged in successfully as ${readyClient.user.tag}!`
    );

    console.log(
      `[Bot] Ready to process commands in guild ${config.DISCORD_GUILD_ID}`
    );
  });

  // STEP 6: Process Discord slash commands
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {
      await handleInteraction(interaction);
    } catch (error: unknown) {
      console.error(
        `[Bot] Error executing command ${interaction.commandName}:`,
        error
      );

      const content =
        '⚠️ An unexpected error occurred while processing this command.';

      try {
        if (interaction.deferred) {
          await interaction.editReply({ content });
        } else if (interaction.replied) {
          await interaction.followUp({
            content,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content,
            ephemeral: true,
          });
        }
      } catch (replyError) {
        console.error(
          '[Bot] Unable to send error response:',
          replyError
        );
      }
    }
  });

  // STEP 7: Connect to Discord only after DB readiness
  console.log('[Bot] Connecting to Discord Gateway...');

  await client.login(config.DISCORD_TOKEN);
}

// Start bot and report initialization failures
startBot().catch((error: unknown) => {
  console.error('[Bot] Startup failed:', error);
  process.exitCode = 1;
});
