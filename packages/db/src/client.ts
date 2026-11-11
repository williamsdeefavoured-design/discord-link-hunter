import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from '@discord-link-hunter/config';
import * as schema from './schema.js';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: postgres.Sql | null = null;
let _connectionTested = false;
let _isConnected = false;

export function resolveConnectionString(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  // If the host is the direct Supabase IPv6 endpoint, resolve to the verified IPv4 pooler
  if (rawUrl.includes('.supabase.co')) {
    try {
      const parsed = new URL(rawUrl.replace('postgresql://', 'http://'));
      const user = parsed.username || 'postgres';
      const pass = parsed.password;
      const dbName = parsed.pathname.replace('/', '') || 'postgres';
      const projectRef = 'dihnmrfujdrfxsoekqgv';

      const poolerUser = user.includes('.') ? user : `${user}.${projectRef}`;
      return `postgresql://${poolerUser}:${encodeURIComponent(pass)}@aws-0-eu-west-1.pooler.supabase.com:5432/${dbName}`;
    } catch {
      return rawUrl;
    }
  }
  return rawUrl;
}

export async function testDatabaseConnection(): Promise<{ connected: boolean; error?: string; endpoint?: string }> {
  const config = getConfig();
  const rawString = config.DIRECT_URL || config.DATABASE_URL;

  if (!rawString) {
    _isConnected = false;
    _connectionTested = true;
    return { connected: false, error: 'DATABASE_URL or DIRECT_URL not set' };
  }

  const connectionString = resolveConnectionString(rawString) || rawString;

  try {
    const testSql = postgres(connectionString, {
      connect_timeout: 4,
      max: 1,
    });
    await testSql`SELECT 1 as connected`;
    await testSql.end();
    _isConnected = true;
    _connectionTested = true;
    return { connected: true, endpoint: 'Supabase PostgreSQL Pooler (aws-0-eu-west-1)' };
  } catch (err: any) {
    _isConnected = false;
    _connectionTested = true;
    return { connected: false, error: err.message || 'Database connection failed' };
  }
}

export function isDatabaseConnectedSync(): boolean {
  return _isConnected;
}

export function getDbClient() {
  if (!_db) {
    const config = getConfig();
    const rawString = config.DIRECT_URL || config.DATABASE_URL;

    if (!rawString) {
      return null;
    }

    const connectionString = resolveConnectionString(rawString) || rawString;

    try {
      _client = postgres(connectionString, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 5,
        prepare: false,
      });

      _db = drizzle(_client, { schema });
      _isConnected = true;
    } catch {
      return null;
    }
  }

  return _db;
}
