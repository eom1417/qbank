import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileMigrationProvider, Migrator, type MigrationResultSet } from 'kysely/migration';
import type { Db } from './platform/db/index.js';

// Works from src/server (tsx) and dist/src/server (compiled): migrations/ sits two levels up.
const MIGRATIONS = fileURLToPath(new URL('../../migrations', import.meta.url));

/** Applies every pending migration in order; throws if any fails. */
export async function migrateToLatest(db: Db): Promise<MigrationResultSet> {
  const provider = new FileMigrationProvider({ fs, path, migrationFolder: MIGRATIONS });
  const result = await new Migrator({ db, provider }).migrateToLatest();
  if (result.error) throw result.error;
  return result;
}
