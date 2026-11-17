// M34 P9 (Q16): how long a pipeline import has waited for its subscription in all, so a job paused
// for more than 7 days ends with `no_quota` instead of waiting for ever. Additive only.
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table import_job add column paused_ms integer not null default 0`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table import_job drop column if exists paused_ms`.execute(db);
}
