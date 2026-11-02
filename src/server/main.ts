import { buildApp } from './app.js';
import { systemClock } from './platform/clock.js';
import { loadConfig } from './platform/config/index.js';
import { createDb } from './platform/db/index.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
const app = buildApp({ config, db, clock: systemClock });

const shutdown = async () => {
  await app.close();
  await db.destroy();
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

await app.listen({ host: config.host, port: config.port });
