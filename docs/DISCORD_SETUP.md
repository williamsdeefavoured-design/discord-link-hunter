# Discord Bot Setup & Slash Commands Guide

This guide explains how to configure the Discord Developer Portal application, set least-privilege permissions, invite the bot to your development server, and register guild-scoped slash commands.

---

## 1. Discord Developer Portal Configuration

1. Visit [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and name it `Discord Link Hunter`.
3. In the **Bot** tab:
   - Click **Add Bot**.
   - Under **Token**, click **Reset Token** and copy the token to your private `.env` file under `DISCORD_TOKEN`.
   - **Privileged Gateway Intents**: None of the privileged intents (Message Content, Server Members, Presence) are required! The bot uses least-privilege `GatewayIntentBits.Guilds` only.
4. In the **General Information** tab:
   - Copy the **Application ID** and paste it into `.env` under `DISCORD_CLIENT_ID`.
5. In your Discord client:
   - Enable Developer Mode (Settings -> Advanced -> Developer Mode).
   - Right-click your test server name and click **Copy Server ID**.
   - Paste the ID into `.env` under `DISCORD_GUILD_ID`.

---

## 2. Generating the OAuth2 Bot Invite Link

1. In the Developer Portal, navigate to **OAuth2** -> **URL Generator**.
2. Under **Scopes**, select:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, select:
   - `Send Messages`
   - `Embed Links`
   - `Attach Files` (for CSV/JSON exports)
   - `Read Message History`
4. Copy the generated URL and open it in your browser to authorize and add the bot to your test server.

---

## 3. Registering Guild Slash Commands

Guild commands register instantly for development (unlike global commands, which can take up to an hour to propagate).

Run the command registration script:

```bash
npm run register
```

Expected output:
```text
[Bot Register] Refreshing 8 guild slash commands for guild 1569797552964903052...
[Bot Register] Successfully registered 8 guild slash commands!
```

---

## 4. Available Slash Commands

- `/ping`: Check bot latency and API connectivity status.
- `/hunt`: Queue a targeted community search (options: `topic`, `language`, `limit`).
- `/deepsearch`: Opt-in Depth 2 search with Tavily expansion.
- `/verify`: Verify any public Discord invite link (`https://discord.gg/code`).
- `/results`: View top results from a previous search job ID.
- `/status`: Check execution progress of a search job.
- `/export`: Export job results as a `.csv` or `.json` file attachment.
- `/dashboard`: Surface the URL of the local web dashboard.

