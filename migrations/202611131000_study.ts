// M9 study: sessions with a fixed snapshot of each question at the time it was asked (FR-23-007),
// one recorded answer per item (FR-12-006), and the owner's flags and favourites (FR-12-007).
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

const STATEMENTS = [
  sql`create table study_session (
    id uuid primary key,
    owner_id uuid not null references account(id) on delete cascade,
    mode text not null check (mode in ('tutor', 'exam')),
    kind text not null check (kind in ('random', 'new', 'wrong', 'due', 'flagged', 'retry')),
    scope jsonb not null,
    size integer not null check (size > 0),
    status text not null check (status in ('active', 'finished')),
    position integer not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    finished_at timestamptz
  )`,
  sql`create index study_session_owner on study_session (owner_id, status)`,
  sql`create table study_item (
    session_id uuid not null references study_session(id) on delete cascade,
    position integer not null,
    owner_id uuid not null,
    question_id uuid references question(id) on delete set null,
    snapshot jsonb not null,
    chosen text[],
    correct boolean,
    seconds integer,
    answered_at timestamptz,
    primary key (session_id, position)
  )`,
  sql`create index study_item_question on study_item (owner_id, question_id)`,
  sql`create table question_mark (
    owner_id uuid not null references account(id) on delete cascade,
    question_id uuid not null references question(id) on delete cascade,
    flagged boolean not null default false,
    favorite boolean not null default false,
    updated_at timestamptz not null,
    primary key (owner_id, question_id)
  )`,
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const statement of STATEMENTS) await statement.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ['question_mark', 'study_item', 'study_session'])
    await db.schema.dropTable(table).execute();
}
