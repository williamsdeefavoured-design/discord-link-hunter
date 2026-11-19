
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from '@discord-link-hunter/config';
import * as schema from './schema.js';

/**
 * Discord Link Hunter
 * PostgreSQL / Supabase Database Client
 *
 * Uses the connection string supplied in .env.
 * Does not generate or rewrite Supabase hostnames.
 */

type Database = ReturnType<typeof drizzle<typeof schema>>;

export function createDatabase(client: postgres.Sql): Database {
  return drizzle(client, { schema });
}

// Shared database instances
let _db: Database | null = null;
let _client: postgres.Sql | null = null;

// Represents the result of the latest connection test
let _isConnected = false;

/**
 * Read a connection string without modifying its host,
 * username, password, port, or query parameters.
 */
export function resolveConnectionString(
  rawUrl?: string
): string | null {
  const connectionString = rawUrl?.trim();

  return connectionString || null;
}

/**
 * Obtain the configured database URL.
 *
 * DATABASE_URL is preferred for normal application use.
 * DIRECT_URL remains a fallback for compatibility.
 */
function getConnectionString(): string | null {
  const config = getConfig();

  return (
    resolveConnectionString(config.DATABASE_URL) ??
    resolveConnectionString(config.DIRECT_URL)
  );
}

/**
 * Return a diagnostic error code without exposing
 * connection strings or database passwords.
 */
function getSafeErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;

    if (
      typeof code === 'string' &&
      /^[a-zA-Z0-9_]+$/.test(code)
    ) {
      return code;
    }
  }

  if (error instanceof Error) {
    return error.name;
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Initialize the shared PostgreSQL client.
 *
 * Creating the client does NOT prove that the database
 * connection is working.
 */
export function getDbClient(): Database | null {
  if (_db) {
    return _db;
  }

  try {
    const connectionString = getConnectionString();

    if (!connectionString) {
      _isConnected = false;
      return null;
    }

    _client = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 5,
      prepare: false,
    });

    _db = createDatabase(_client);

    // Do not mark connected here.
    // A real database query must succeed first.

    return _db;
  } catch {
    _db = null;
    _client = null;
    _isConnected = false;

    return null;
  }
}

/**
 * Perform a real database connectivity test.
 *
 * SELECT 1 is read-only and does not create,
 * modify, or delete database records.
 */
export async function testDatabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  endpoint?: string;
}> {
  try {
    const connectionString = getConnectionString();

    if (!connectionString) {
      _isConnected = false;

      return {
        connected: false,
        error: 'DATABASE_URL or DIRECT_URL is not configured',
      };
    }

    const db = getDbClient();

    if (!db || !_client) {
      _isConnected = false;

      return {
        connected: false,
        error: 'Unable to initialize PostgreSQL client',
      };
    }

    // Verify that PostgreSQL actually accepts a query.
    await _client`SELECT 1 AS connected`;

    _isConnected = true;

    return {
      connected: true,
      endpoint: 'PostgreSQL (configured connection)',
    };
  } catch (error: unknown) {
    _isConnected = false;

    return {
      connected: false,
      error: `Database connection test failed (${getSafeErrorCode(error)}). Check the database URL, credentials, and network.`,
    };
  }
}

/**
 * Return the last successfully tested connection state.
 *
 * This is a cached diagnostic status, not a guarantee
 * that the database is currently reachable.
 *
 * Call testDatabaseConnection() to refresh the status.
 */
export function isDatabaseConnectedSync(): boolean {
  return _isConnected;
}
