// M34 P5: what an import's AI lessons cost (tokens per lesson and model, and whether a provider
// gave no usage so they were estimated), for the import report. Additive only.
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table import_job add column ai_usage jsonb`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table import_job drop column if exists ai_usage`.execute(db);
}
