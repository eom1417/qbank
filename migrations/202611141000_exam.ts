// M10 exams: the timing the owner saw before starting (FR-13-002…004), the server's deadline
// (FR-13-011), answers saved on every change until submission (FR-13-007), per-item flags
// (FR-13-009), and when a timed question was first opened (FR-13-004).
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

const SESSION_COLUMNS = sql`alter table study_session
  add column timing text not null default 'none' check (timing in ('none', 'total', 'per_question')),
  add column timing_seconds integer check (timing_seconds is null or timing_seconds > 0),
  add column deadline_at timestamptz,
  add column ended_by text check (ended_by in ('owner', 'time'))`;

const ITEM_COLUMNS = sql`alter table study_item
  add column flagged boolean not null default false,
  add column saved_at timestamptz,
  add column opened_at timestamptz`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await SESSION_COLUMNS.execute(db);
  await ITEM_COLUMNS.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const column of ['opened_at', 'saved_at', 'flagged'])
    await db.schema.alterTable('study_item').dropColumn(column).execute();
  for (const column of ['ended_by', 'deadline_at', 'timing_seconds', 'timing'])
    await db.schema.alterTable('study_session').dropColumn(column).execute();
}
