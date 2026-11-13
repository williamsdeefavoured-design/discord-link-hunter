
import { buildServer } from './server.js';
import { getConfig } from '@discord-link-hunter/config';
import { testDatabaseConnection } from '@discord-link-hunter/db';

async function startServer() {
  const config = getConfig();

  const databaseConfigured = Boolean(
    config.DATABASE_URL || config.DIRECT_URL
  );

  // Verify the configured database before creating
  // the API server and its repository.
  if (databaseConfigured) {
    console.log('[API] Testing PostgreSQL connection...');

    const result = await testDatabaseConnection();

    if (!result.connected) {
      throw new Error(
        `[API] Database connection failed: ${
          result.error || 'Unknown connection error'
        }`
      );
    }

    console.log('[API] PostgreSQL connection verified.');
  } else if (config.NODE_ENV === 'production') {
    throw new Error(
      '[API] Production requires a PostgreSQL connection.'
    );
  } else {
    console.warn(
      '[API] No database configured. Development storage will be used.'
    );
  }

  // Create the server only AFTER verifying
  // the database connection.
  const app = buildServer();

  const address = await app.listen({
    port: config.API_PORT,
    host: '0.0.0.0',
  });

  console.log(`[API] Discord Link Hunter running at ${address}`);
  console.log(`[API] Research mode: ${config.SEARCH_MODE}`);
}

startServer().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown error';

  console.error('[API] Startup failed:', message);
  process.exitCode = 1;
});
