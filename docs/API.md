# HTTP API Reference

The Fastify API server runs on port `3001` by default and exposes endpoints for search orchestration, verification, results querying, and exports.

---

### `GET /health`
Returns the operational health of the API, database connectivity, and configured search providers.

**Response `200 OK`**:
```json
{
  "status": "ok",
  "service": "discord-link-hunter-api",
  "mode": "mock",
  "database": {
    "connected": true,
    "usingMockRepo": false
  },
  "providers": {
    "serper": true,
    "tavily": true
  },
  "timestamp": "2026-11-10T22:00:00.000Z"
}
```

---

### `POST /api/jobs`
Queues a new community discovery search job.

**Request Body**:
```json
{
  "topics": ["forex", "xauusd"],
  "languages": ["en", "de"],
  "limit": 10,
  "depth": 1,
  "minMembers": 1000,
  "mode": "mock",
  "dryRun": false
}
```

**Response `202 Accepted`**:
```json
{
  "message": "Search job queued successfully",
  "jobId": "job-1731276000000-abc12",
  "mode": "mock"
}
```

---

### `GET /api/jobs`
Lists recent search jobs.

**Query Parameters**:
- `limit` (integer, optional, default: 20)

---

### `GET /api/jobs/:id`
Retrieves details, progress counts, and status for a specific job.

---

### `POST /api/jobs/:id/cancel`
Cancels an active or queued job.

---

### `GET /api/results/:id`
Retrieves ranked communities for a completed or partial search job.

**Query Parameters**:
- `minScore` (integer, e.g. `75`)
- `status` (`valid`, `expired_or_revoked`, `all`)
- `topic` (`forex`, `xauusd`, `stocks`, etc.)
- `language` (`en`, `de`, `es`, `pt`, `fr`, `ar`)

**Response `200 OK`**:
```json
{
  "jobId": "job-seed-demo-01",
  "count": 3,
  "results": [
    {
      "invite": {
        "code": "gold-scalpers-vip",
        "canonicalUrl": "https://discord.gg/gold-scalpers-vip",
        "status": "valid",
        "community": {
          "id": "guild-gold-202",
          "name": "Gold & XAUUSD Scalpers",
          "approximateMemberCount": 8200
        }
      },
      "score": 95,
      "scoreBreakdown": {
        "topicRelevance": 35,
        "inviteValidity": 20,
        "languageMatch": 15,
        "sourceCredibility": 7,
        "freshness": 10,
        "activitySignal": 10,
        "total": 95
      },
      "detectedTopics": ["xauusd", "day_trading"],
      "detectedLanguage": "en"
    }
  ]
}
```

---

### `GET /api/export/:id`
Exports job results as a downloadable CSV or JSON file.

**Query Parameters**:
- `format`: `csv` or `json` (default: `json`)

---

### `POST /api/verify`
Performs an isolated verification check on a single Discord invite URL or code.

**Request Body**:
```json
{
  "url": "https://discord.gg/gold-scalpers-vip"
}
```

---

### `GET /api/usage`
Returns provider request counts and estimated search credits consumed.

