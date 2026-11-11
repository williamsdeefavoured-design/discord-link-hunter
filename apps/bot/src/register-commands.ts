import { REST, Routes } from 'discord.js';
import { getConfig } from '@discord-link-hunter/config';
import { slashCommands } from './commands.js';

export async function registerGuildCommands() {
  const config = getConfig();

  if (!config.DISCORD_TOKEN || !config.DISCORD_CLIENT_ID || !config.DISCORD_GUILD_ID) {
    console.error('[Bot Register] Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID in configuration.');
    return { success: false, reason: 'Missing credentials' };
  }

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const commandData = slashCommands.map((cmd) => cmd.toJSON());

  try {
    console.log(`[Bot Register] Refreshing ${commandData.length} guild slash commands for guild ${config.DISCORD_GUILD_ID}...`);

    const result = (await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
      { body: commandData }
    )) as any[];

    console.log(`[Bot Register] Successfully registered ${result.length} guild slash commands!`);
    return { success: true, count: result.length };
  } catch (err: any) {
    console.error('[Bot Register] Failed to register slash commands:', err.message);
    return { success: false, reason: err.message };
  }
}

if (process.argv[1]?.endsWith('register-commands.ts') || process.argv[1]?.endsWith('register-commands.js')) {
  registerGuildCommands();
}

