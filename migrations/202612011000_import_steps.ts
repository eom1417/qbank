// M39: the seven detection steps an import reports to its card (docs/plans/m39-detection-system.md §5).
// Additive only. Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table import_job add column steps jsonb`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table import_job drop column if exists steps`.execute(db);
}
