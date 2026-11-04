// Which model of the chosen AI instance an import runs on; null means that instance's default.
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table import_job add column ai_model text`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table import_job drop column ai_model`.execute(db);
}
