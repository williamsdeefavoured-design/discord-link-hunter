# Deployment Topologies & Runbook

This document outlines recommended deployment topologies for hosting the Discord Bot and Web Dashboard.

---

## Architecture Topology

The application consists of three services:
1. **Discord Bot Client** (`apps/bot`): Long-running Node.js process requiring an active WebSocket gateway connection to Discord.
2. **Fastify API Server** (`apps/api`): HTTP API handling incoming search requests, webhooks, and job processing.
3. **Next.js Web Dashboard** (`apps/web`): Responsive React/Next.js frontend.

---

## Deployment Options

### Option 1: Unified Container / VPS (Recommended for MVP)
- **Target**: Railway, Render, Fly.io, or Ubuntu VPS.
- **Process Manager**: PM2 or Docker Compose managing:
  - `npm run start --workspace=@discord-link-hunter/api`
  - `npm run start --workspace=@discord-link-hunter/bot`
  - `npm run start --workspace=@discord-link-hunter/web`
- **Database**: Managed Supabase PostgreSQL with transaction pooler configured.

### Option 2: Split Bot & Serverless Web
- **Bot & API**: Hosted on a persistent container service (e.g., Railway or Fly.io).
- **Web Dashboard**: Deployed to Vercel, pointing `NEXT_PUBLIC_API_BASE_URL` to the API domain.

---

## Environment Variables Checklist

Ensure these variables are configured in your production secret manager:

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Discord Bot Token |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_GUILD_ID` | Development Guild ID (or omit for global commands) |
| `SERPER_API_KEY` | Serper Google Search API Key |
| `TAVILY_API_KEY` | Tavily Research API Key |
| `SEARCH_MODE` | `live` or `mock` |
| `DATABASE_URL` | Supabase Postgres Pooler Connection String |
| `DIRECT_URL` | Supabase Postgres Direct Connection String |
| `API_PORT` | `3001` (or host assigned `PORT`) |
| `WEB_ORIGIN` | Public URL of web dashboard (for CORS) |
| `NEXT_PUBLIC_API_BASE_URL` | Public API URL accessible from browser |

