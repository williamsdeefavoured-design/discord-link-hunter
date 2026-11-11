# Security, Safety & Compliance Policy

Discord Link Hunter is designed with strict adherence to security boundaries, privacy compliance, and external service contracts.

---

## 1. Secrets Management

- **Zero Secrets in Code or Logs**: All credentials (`DISCORD_TOKEN`, `SERPER_API_KEY`, `TAVILY_API_KEY`, `DATABASE_URL`) are read exclusively from the root `.env` file at runtime.
- **Git Protection**: `.gitignore` strictly excludes `.env`, `.env.*`, certificates, logs, and sensitive directories.
- **Diagnostics Masking**: Diagnostic endpoints (`/health`, `npm run doctor`) output masked boolean presence (`configured: yes`) or truncated hashes (`secr...t123`), never full credential strings.

---

## 2. Server-Side Request Forgery (SSRF) Defense

When following outbound search links or inspecting web pages:
- **Protocol Enforcement**: Only `http:` and `https:` schemes are permitted; `file:`, `gopher:`, `ftp:`, etc., are rejected.
- **Blocked Address Ranges**:
  - Loopback: `127.0.0.0/8`, `::1`, `localhost`
  - RFC 1918 Private Ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  - Cloud Instance Metadata: `169.254.169.254` (AWS, GCP, Azure metadata endpoints)
  - Broadcast / Unspecified: `0.0.0.0`, `255.255.255.255`

---

## 3. Discord Platform Compliance

- **No Self-Bots**: Only authorized Discord Bot applications using official developer tokens are used.
- **No Private Scraping**: The application never joins servers automatically, harvests private member lists, or monitors user chat channels.
- **Official Verification**: Invites are validated exclusively via documented Discord REST endpoints (`/api/v10/invites/{code}`), respecting official rate limits and headers.
- **No Spam or Unsolicited DMs**: The bot operates only via user-initiated slash commands and does not broadcast unsolicited direct messages.

---

## 4. Quotas & Operational Limits

- **Max Queries Per Job**: Default 12 queries.
- **Max Concurrency**: Default 2 concurrent requests.
- **Daily Provider Cap**: Default 50 requests per provider.
- **HTTP Rate Limiting**: Fastify API enforces a 100 requests / minute rate limit to prevent abuse.

