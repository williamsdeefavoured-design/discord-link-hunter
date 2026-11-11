# Discord Link Hunter 🏹

AI-ready, multilingual research and Discord community discovery platform to find, validate, deduplicate, explain, and rank *publicly shared* Discord invitation links associated with trading and financial education.

---

## Features

- **Multilingual Trading Discovery**: Search across 6 languages: English (`en`), German (`de`), Spanish (`es`), Portuguese (`pt`), French (`fr`), and Arabic (`ar`). Native-language trading synonyms prevent awkward translations.
- **Multi-Provider Architecture**: Serper (Google-indexed primary discovery) and Tavily (`@tavily/core`, secondary expansion & content extraction).
- **Dual Interface Access**:
  - **Discord Bot**: Guild-scoped slash commands (`/ping`, `/hunt`, `/deepsearch`, `/verify`, `/results`, `/status`, `/export`, `/dashboard`).
  - **Web Dashboard**: Modern dark-theme responsive Next.js dashboard with live job monitoring, score breakdowns, and CSV/JSON exports.
- **Transparent 0–100 Ranking Engine**:
  - 35 pts: Trading topic relevance
  - 20 pts: Confirmed active invite
  - 15 pts: Language match
  - 10 pts: Source credibility / cross-domain discovery
  - 10 pts: Verification freshness (<24h)
  - 10 pts: Verified activity / size signal (only when verified metadata exists)
- **Security & Safety by Design**:
  - SSRF protection against private, link-local, loopback, and metadata IPs (`169.254.169.254`).
  - Zero scraping of private server channels or user member lists.
  - Strict daily provider request caps and query budgeting.
  - Zero secrets in logs, stdout, or documentation.

---

## Quick Start (Mock Mode)

The project includes a complete offline **Mock Mode** using realistic fixtures and an in-memory repository. You can test and inspect the full pipeline without spending API credits or configuring external databases.

```bash
# 1. Install dependencies
npm install

# 2. Run system health check
npm run doctor

# 3. Run full automated test suite
npm test

# 4. Run end-to-end mock smoke test
npm run smoke:mock

# 5. Start development servers
npm run dev:api    # Starts Fastify API on http://localhost:3001
npm run dev:web    # Starts Next.js Dashboard on http://localhost:3000
npm run dev:bot    # Starts Discord Bot Client
```

---

## Switching to Live Mode

To run with live external APIs:

1. Open `.env` (which is already Git-ignored and created at root).
2. Ensure your keys are populated:
   - `SERPER_API_KEY`: from [serper.dev](https://serper.dev/)
   - `TAVILY_API_KEY`: from [tavily.com](https://tavily.com/)
   - `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`: from [Discord Developer Portal](https://discord.com/developers/applications)
   - `DATABASE_URL`: from Supabase Project Connect settings
3. Change `SEARCH_MODE=live`.
4. Register guild commands:
   ```bash
   npm run register
   ```
5. Run a tiny bounded live test (consumes only 1 search query):
   ```bash
   npm run smoke:live
   ```

---

## Project Structure

```text
discord-link-hunter/
├── apps/
│   ├── api/                 # Fastify HTTP API, job endpoints, export routes
│   ├── bot/                 # Discord.js bot client & slash command handlers
│   └── web/                 # Next.js App Router dark-theme dashboard
├── packages/
│   ├── config/              # Zod environment validation & safe secret masking
│   ├── core/                # Types, languages dictionary, invite parser, SSRF & ranking
│   ├── db/                  # Drizzle ORM, Supabase schema, in-memory & postgres repos
│   └── research/            # Serper, Tavily, and Mock search orchestrator
├── scripts/
│   ├── doctor.ts            # Safe diagnostics (never leaks keys)
│   ├── smoke-mock.ts        # End-to-end mock test runner
│   └── smoke-live.ts        # Bounded live search smoke test
├── tests/                   # Vitest unit and integration test suite
└── docs/                    # Complete architectural and operational guides
```

---

## Documentation

- [Architecture & Data Flow](docs/ARCHITECTURE.md)
- [Database Schema & Migrations](docs/DATABASE.md)
- [HTTP API Reference](docs/API.md)
- [Discord Bot Setup Guide](docs/DISCORD_SETUP.md)
- [Security & Threat Model](docs/SECURITY.md)
- [Deployment Topologies](docs/DEPLOYMENT.md)
- [Troubleshooting Runbook](docs/TROUBLESHOOTING.md)
- [Implementation Milestone Status](docs/IMPLEMENTATION_STATUS.md)

