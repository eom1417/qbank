import { Kysely, PostgresDialect, type PostgresPool } from 'kysely';
import pg from 'pg';
import { createPgliteDialectPool } from './pglite.js';
import type { Database } from './schema.js';

export type Db = Kysely<Database>;

/** `pglite:` runs the bundled database in this process (`pglite:` alone keeps it in memory). */
const PGLITE = 'pglite:';

/**
 * The database: a PostgreSQL server (`postgres://…`), or PGlite for a local install with nothing
 * else to set up (`pglite:<directory>`). Both speak the same SQL, so migrations and queries are one.
 */
export function createDb(databaseUrl: string): Db {
  const pool = databaseUrl.startsWith(PGLITE)
    ? (createPgliteDialectPool(
        databaseUrl.slice(PGLITE.length) || undefined,
      ) as unknown as PostgresPool)
    : new pg.Pool({ connectionString: databaseUrl, max: 10 });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
