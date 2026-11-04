// M11: Smart Mix and weak-question sessions join the session kinds (FR-14-001, FR-14-004).
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

const KINDS = (list: string) =>
  sql.raw(`alter table study_session drop constraint study_session_kind_check,
    add constraint study_session_kind_check check (kind in (${list}))`);

export async function up(db: Kysely<unknown>): Promise<void> {
  await KINDS(`'random', 'new', 'wrong', 'due', 'flagged', 'retry', 'weak', 'smart_mix'`).execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await KINDS(`'random', 'new', 'wrong', 'due', 'flagged', 'retry'`).execute(db);
}
