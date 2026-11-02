import { migrateToLatest } from './migrator.js';
import { loadConfig } from './platform/config/index.js';
import { createDb } from './platform/db/index.js';

const db = createDb(loadConfig().databaseUrl);
try {
  const { results = [] } = await migrateToLatest(db);
  for (const result of results) console.log(`${result.status}: ${result.migrationName}`);
  console.log(results.length ? 'migrations applied' : 'database already up to date');
} finally {
  await db.destroy();
}
