import { Client, GatewayIntentBits } from 'discord.js';

export function createBotClient(): Client {
  // Least privilege intents: only Guilds intent required for slash commands!
  return new Client({
    intents: [GatewayIntentBits.Guilds],
  });
}

