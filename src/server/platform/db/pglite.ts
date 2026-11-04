import { mkdirSync } from 'node:fs';
import { PGlite, types } from '@electric-sql/pglite';

/**
 * PGlite (Postgres compiled to WebAssembly, in this process) behind the small pool interface
 * Kysely's `PostgresDialect` uses. PGlite has one session, so each checkout holds a lock until it
 * is released: a transaction never interleaves with another query. Values are parsed as `pg`
 * parses them (int8 and numeric stay strings), so the rest of the app cannot tell the two apart.
 */
export function createPgliteDialectPool(dataDir: string | undefined) {
  if (dataDir) mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new PGlite({
    ...(dataDir ? { dataDir } : {}),
    parsers: { [types.INT8]: (value) => value, [types.NUMERIC]: (value) => value },
  });
  let tail: Promise<void> = Promise.resolve();
  const client = {
    query: (sql: string, parameters: readonly unknown[]) => db.query(sql, [...parameters]),
  };
  return {
    async connect() {
      let release = () => {};
      const turn = new Promise<void>((resolve) => (release = resolve));
      const previous = tail;
      tail = previous.then(() => turn);
      await previous;
      return { ...client, release };
    },
    end: () => db.close(),
  };
}
