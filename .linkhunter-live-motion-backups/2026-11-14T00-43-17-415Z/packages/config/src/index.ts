import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Try to locate root .env traversing upwards
function loadRootEnv() {
  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    const envPath = path.join(curr, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  dotenv.config();
}

loadRootEnv();

export const ConfigSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().optional().default(''),
  DISCORD_CLIENT_ID: z.string().optional().default(''),
  DISCORD_GUILD_ID: z.string().optional().default(''),
  ALLOWED_DISCORD_USER_IDS: z
    .string()
    .optional()
    .default('')
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    ),

  // Search
  SERPER_API_KEY: z.string().optional().default(''),
  TAVILY_API_KEY: z.string().optional().default(''),
  SEARCH_MODE: z.enum(['mock', 'live']).default('mock'),
  SEARCH_MAX_QUERIES_PER_JOB: z.coerce.number().default(12),
  SEARCH_MAX_RESULTS_PER_QUERY: z.coerce.number().default(10),
  SEARCH_MAX_DEPTH: z.coerce.number().default(2),
  SEARCH_MAX_CONCURRENT_REQUESTS: z.coerce.number().default(2),
  SEARCH_DAILY_PROVIDER_REQUEST_CAP: z.coerce.number().default(50),

  // Supabase
  DATABASE_URL: z.string().optional().default(''),
  DIRECT_URL: z.string().optional().default(''),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional().default(''),
  SUPABASE_SECRET_KEY: z.string().optional().default(''),
  SUPABASE_JWKS_URL: z.string().optional().default(''),

  // Server & Web
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  API_SECRET_KEY: z.string().optional().default(''),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_API_BASE_URL: z.string().default('http://localhost:3001'),

  // AI runtime
  AI_PROVIDER: z.enum(['none', 'openai', 'gemini', 'anthropic']).default('none'),
  OPENAI_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().optional().default(''),
  AI_DAILY_SPEND_CAP_USD: z.coerce.number().default(0),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    const parsed = ConfigSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Environment validation failed: ${issues}`);
    }
    _config = parsed.data;
  }
  return _config;
}

export function maskSecret(secret?: string | null): string {
  if (!secret) return '(not configured)';
  if (secret.length <= 8) return '********';
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export function getRedactedConfigSummary() {
  const cfg = getConfig();
  return {
    environment: cfg.NODE_ENV,
    apiPort: cfg.API_PORT,
    searchMode: cfg.SEARCH_MODE,
    hasDiscordToken: Boolean(cfg.DISCORD_TOKEN),
    hasDiscordClientId: Boolean(cfg.DISCORD_CLIENT_ID),
    hasDiscordGuildId: Boolean(cfg.DISCORD_GUILD_ID),
    hasSerperKey: Boolean(cfg.SERPER_API_KEY),
    hasTavilyKey: Boolean(cfg.TAVILY_API_KEY),
    hasDatabaseUrl: Boolean(cfg.DATABASE_URL),
    hasSupabaseUrl: Boolean(cfg.SUPABASE_URL),
    hasSupabasePublishableKey: Boolean(cfg.SUPABASE_PUBLISHABLE_KEY),
    hasSupabaseSecretKey: Boolean(cfg.SUPABASE_SECRET_KEY),
    aiProvider: cfg.AI_PROVIDER,
    quotas: {
      maxQueriesPerJob: cfg.SEARCH_MAX_QUERIES_PER_JOB,
      maxResultsPerQuery: cfg.SEARCH_MAX_RESULTS_PER_QUERY,
      maxDepth: cfg.SEARCH_MAX_DEPTH,
      maxConcurrent: cfg.SEARCH_MAX_CONCURRENT_REQUESTS,
      dailyProviderCap: cfg.SEARCH_DAILY_PROVIDER_REQUEST_CAP,
    },
  };
}

export function getValidApiKeys(): string[] {
  const cfg = getConfig();
  const keys: string[] = [];
  // The API uses a dedicated secret. Supabase publishable keys are public
  // identifiers and MUST NOT grant access to paid search execution.
  if (cfg.API_SECRET_KEY) keys.push(cfg.API_SECRET_KEY);

  // Preserve the legacy local test key only outside production.
  if (cfg.NODE_ENV !== 'production') {
    keys.push('dlh_dev_secret_key');
  }
  return keys;
}

export function getPrimaryApiSecret(): string {
  const cfg = getConfig();
  return (
    cfg.API_SECRET_KEY ||
    (cfg.NODE_ENV === 'production' ? '' : 'dlh_dev_secret_key')
  );
}

export function getAllowedCorsOrigins(): string[] {
  const cfg = getConfig();
  const rawOrigins = cfg.WEB_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  const standard = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  return Array.from(new Set([...rawOrigins, ...standard]));
}

