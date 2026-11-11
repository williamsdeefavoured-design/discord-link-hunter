# Troubleshooting Runbook

This guide covers common issues and resolutions when running Discord Link Hunter.

---

### 1. `EPERM: operation not permitted` during local setup on Windows
- **Cause**: Windows file permissions or sandbox integrity level restrictions on the project directory.
- **Resolution**:
  - Grant write access to application packages:
    ```powershell
    icacls . /grant "*S-1-15-2-1:(OI)(CI)(F)" /t
    ```
  - Re-run `npm install`.

---

### 2. Discord Bot: `401 Unauthorized` on Login
- **Cause**: Invalid or expired `DISCORD_TOKEN`.
- **Resolution**:
  - Navigate to the [Discord Developer Portal](https://discord.com/developers/applications).
  - Go to the **Bot** tab, click **Reset Token**, and update `DISCORD_TOKEN` in `.env`.
  - Ensure there are no surrounding quotes or whitespace in `.env`.

---

### 3. Slash Commands Not Appearing in Discord
- **Cause**: Commands were not registered or were registered globally (which takes up to an hour).
- **Resolution**:
  - Run the registration script specifically targeting your server guild:
    ```bash
    npm run register
    ```
  - Check that `DISCORD_GUILD_ID` matches your server ID.
  - Restart your Discord client (`Ctrl + R`).

---

### 4. Supabase: `connection to server at db... failed: Connection refused` or Timeout
- **Cause**: Network restrictions, direct IPv6 unavailability, or incorrect password.
- **Resolution**:
  - Check if your host network supports direct IPv6 connections.
  - If direct connection fails, use the Supabase connection pooler URL (port 6543) instead of direct connection (port 5432).
  - Verify your password in the database connection string.
  - Note: The app automatically falls back to the in-memory mock repository if the database cannot be reached, allowing uninterrupted local testing.

---

### 5. Serper / Tavily Rate Limits (`429 Too Many Requests`)
- **Cause**: Monthly quota depleted or request burst limits reached.
- **Resolution**:
  - The orchestrator automatically catches 429 errors and records them in the job diagnostics.
  - If Serper hits rate limits, the orchestrator automatically attempts fallback to Tavily.
  - Switch to `SEARCH_MODE=mock` to continue development without consuming external search quotas.

