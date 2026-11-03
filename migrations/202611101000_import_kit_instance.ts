import { sql, type Kysely } from 'kysely';

type Db = Kysely<unknown>;

// Immutable once applied: add a new migration instead of editing this one.
// DEC-30: an import's AI is a provider instance of the AI providers kit (an id such as
// "codex" or "claudeAgent"), no longer a stored connection's UUID.
export async function down(db: Db): Promise<void> {
  await sql`update import_job set ai_provider_id = null`.execute(db);
  await sql`alter table import_job alter column ai_provider_id type uuid using ai_provider_id::uuid`.execute(
    db,
  );
}

export async function up(db: Db): Promise<void> {
  await sql`alter table import_job alter column ai_provider_id type text`.execute(db);
}
