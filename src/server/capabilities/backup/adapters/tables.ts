import { sql } from 'kysely';
import type { Db } from '../../../platform/db/index.js';

/** Kysely's own bookkeeping: the schema version is recorded apart, never restored as rows. */
const SKIPPED = new Set(['kysely_migration', 'kysely_migration_lock']);
const BATCH = 200;

export type TableRows = Record<string, unknown>[];

/** Every table of the app, parents before children (foreign keys), so rows insert in order. */
export async function tablesInOrder(db: Db): Promise<string[]> {
  const tables = await sql<{ name: string }>`
    select table_name as name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'`.execute(db);
  const edges = await sql<{ child: string; parent: string }>`
    select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
    from pg_constraint c where c.contype = 'f'`.execute(db);
  const names = tables.rows.map((t) => t.name).filter((name) => !SKIPPED.has(name));
  const parents = new Map(names.map((name) => [name, new Set<string>()]));
  for (const { child, parent } of edges.rows) if (child !== parent) parents.get(child)?.add(parent);
  const ordered: string[] = [];
  const visit = (name: string, path: Set<string>) => {
    if (ordered.includes(name) || path.has(name)) return;
    path.add(name);
    for (const parent of parents.get(name) ?? []) visit(parent, path);
    ordered.push(name);
  };
  for (const name of names.sort()) visit(name, new Set());
  return ordered;
}

/** The newest migration applied: a backup restores only into the same or a newer schema. */
export async function schemaVersion(db: Db): Promise<string> {
  const row = await sql<{ name: string }>`
    select name from kysely_migration order by name desc limit 1`.execute(db);
  return row.rows[0]?.name ?? '';
}

export const countRows = async (db: Db, table: string) =>
  Number(
    (await sql<{ n: string }>`select count(*) as n from ${sql.table(table)}`.execute(db)).rows[0]
      ?.n ?? 0,
  );

export const dumpTable = async (db: Db, table: string): Promise<TableRows> =>
  (await sql<Record<string, unknown>>`select * from ${sql.table(table)}`.execute(db)).rows;

/** JSON columns take their value as JSON text; the driver would read an array as a SQL array. */
async function jsonColumns(db: Db, table: string) {
  const columns = await sql<{ name: string }>`
    select column_name as name from information_schema.columns
    where table_schema = 'public' and table_name = ${table} and data_type in ('json', 'jsonb')`.execute(
    db,
  );
  return new Set(columns.rows.map((c) => c.name));
}

async function insertRows(db: Db, table: string, rows: TableRows) {
  if (rows.length === 0) return;
  const json = await jsonColumns(db, table);
  const columns = Object.keys(rows[0] ?? {});
  const cell = (row: Record<string, unknown>, column: string) => {
    const value = row[column] ?? null;
    return sql.val(json.has(column) && value !== null ? JSON.stringify(value) : value);
  };
  for (let start = 0; start < rows.length; start += BATCH) {
    const values = rows
      .slice(start, start + BATCH)
      .map((row) => sql`(${sql.join(columns.map((column) => cell(row, column)))})`);
    await sql`insert into ${sql.table(table)} (${sql.join(columns.map((c) => sql.ref(c)))})
      values ${sql.join(values)}`.execute(db);
  }
}

/**
 * Replaces every table's rows with the backup's, all or nothing: one transaction empties them
 * together and refills them parents first. A table the backup lacks is left empty.
 */
export async function replaceAll(db: Db, tables: readonly string[], data: Map<string, TableRows>) {
  await db.transaction().execute(async (tx) => {
    await sql`truncate ${sql.join(tables.map((t) => sql.table(t)))} cascade`.execute(tx);
    for (const table of tables) await insertRows(tx, table, data.get(table) ?? []);
  });
}
