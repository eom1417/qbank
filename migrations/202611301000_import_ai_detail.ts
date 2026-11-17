// M36 (Q119): the provider's own words when it stops an import ("signed out", "model not
// available…"), so the user sees what to fix instead of a class only. Additive only.
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table import_job add column ai_detail text`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table import_job drop column if exists ai_detail`.execute(db);
}
