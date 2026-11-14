# Discord Link Hunter — Finalization Notes

## Scope preserved

The Serper/Tavily research pipeline, ten public source categories, ranking, language handling, invite verification, source provenance, Supabase storage, and Discord commands are unchanged by this UI/security pass.

## Security / deployment requirements

- **Uploaded archive warning:** the original user archive included `.env` and `.git` history. This cleaned deliverable omits both. Rotate any credentials exposed in the original archive before deployment.
- In **production**, the Fastify API requires `API_SECRET_KEY` (at least 32 characters). Use a unique random value, and configure the same value server-side in the Next.js app. Do not prefix it with `NEXT_PUBLIC_`.
- The backend API secret is **not** the Supabase publishable key and must **not** reuse the Supabase service secret.
- Set `API_BASE_URL` **on the Next.js server** to the HTTPS/private Fastify backend URL. The browser always calls its own origin at `/api/...`.
- For this *private single-owner portfolio/client preview*, configure `WEB_ACCESS_USERNAME` and `WEB_ACCESS_PASSWORD` (at least 16 characters) **only on the Next.js server**, and use HTTPS. Production middleware refuses access if these are missing. The browser will prompt for these credentials via HTTP Basic authentication. This is not multi-user identity/roles; replace with full user authentication before providing public user accounts.
- Set `WEB_ORIGIN` to the deployed HTTPS web origin on the API. Set `NODE_ENV=production` in deployed backend and web processes.
- Keep `DISCORD_TOKEN`, `DATABASE_URL`, `SERPER_API_KEY`, `TAVILY_API_KEY`, and other secrets only in server environments.
- Use one always-on API process and one always-on bot process, plus Supabase. Do **not** host the bot on an ephemeral frontend server.
- For local development, the API binds `127.0.0.1` and the Next.js app can call `http://127.0.0.1:3001`. The site authentication gate is enforced in production.

## Quality & scope

- The overview now displays actual recent job counts, rather than hard-coded success claims.
- An empty results view explains when strict relevance vs status/view filters hide matches.
- API `inactiveCount` is independent from the general `excludedCount` so filtering by language or score does not get mislabeled as expired invites.
- The dashboard design is typography-led with restrained blue-grey and teal accents, readable table contrast, consistent focus states, and reduced-motion support.
- Bot `/ping` no longer initializes the repository for a simple health reply.

## Remaining operational limitations

- The workspace's Basic Auth gate is suitable for a private HTTPS preview, not accounts, billing, or multi-tenant users.
- API key authentication by itself authenticates a service, not an end user. Do not publish the raw API key or a public unrestricted web proxy.
- Job recovery uses a conservative 30-minute grace period to avoid marking just-started bot-owned jobs as crashed; it is not a distributed worker lease.
- Active/valid invitations are not endorsements of Discord community safety or trading recommendations.
- Publication across every indexed platform depends on search-index coverage and API quotas.

## Local checks

From project root (after installing dependencies):

```sh
npm run typecheck
npm test
npm run dev:api
npm run dev:web
npm run dev:bot
```

Confirm `/ping`, `/results`, pagination, web jobs/results with active-only filter and the production access gate before sharing a deployment URL. No paid live-search call is needed for these local checks.
