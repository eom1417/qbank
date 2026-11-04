import { buildApp } from './app.js';
import { loadPairingToken } from './capabilities/identity/index.js';
import { migrateToLatest } from './migrator.js';
import { systemClock } from './platform/clock.js';
import { loadConfig } from './platform/config/index.js';
import { createDb } from './platform/db/index.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
// A local install updates its own database on start; a hosted one runs `npm run migrate`.
if (config.mode === 'local') await migrateToLatest(db);
const pairingToken = config.mode === 'local' ? loadPairingToken(config.imports.dataDir) : null;
const app = buildApp({ config, db, clock: systemClock, pairingToken });

const shutdown = async () => {
  await app.close();
  await db.destroy();
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

await app.listen({ host: config.host, port: config.port });
if (pairingToken) {
  app.log.info(
    `QBank is running for you only. To pair another browser (a phone), open #pair=<code> with the code in ${config.imports.dataDir}/pairing-token`,
  );
}
