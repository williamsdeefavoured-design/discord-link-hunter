import { buildServer } from './server.js';
import { getConfig } from '@discord-link-hunter/config';

const config = getConfig();
const app = buildServer();

app.listen({ port: config.API_PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error('[API] Server startup error:', err);
    process.exit(1);
  }
  console.log(`[API] Discord Link Hunter API running at ${address} (mode: ${config.SEARCH_MODE})`);
});

