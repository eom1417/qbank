// M31 (DEC-40): the server operator's console. Users' notes to the operator are kept here (no
// question text unless the user types it), and imports are taken fairly across accounts, which
// needs a fast look-up of running and waiting jobs per account. The operator's e-mail in .env
// only names the role: an account holds it once someone with shell access on the server confirms
// it (scripts/confirm-operator.mjs), so whoever signs up first with that e-mail gains nothing.
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table account add column operator_confirmed_at timestamptz`.execute(db);
  await sql`create table feedback (
    id uuid primary key,
    owner_id uuid not null references account (id) on delete cascade,
    message text not null check (char_length(message) between 1 and 2000),
    screen text not null default '',
    version text not null,
    created_at timestamptz not null default now(),
    closed_at timestamptz
  )`.execute(db);
  await sql`create index feedback_open on feedback (created_at desc) where closed_at is null`.execute(
    db,
  );
  await sql`create index feedback_owner on feedback (owner_id, created_at)`.execute(db);
  await sql`create index import_job_queue on import_job (owner_id, created_at)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index if exists import_job_queue`.execute(db);
  await sql`drop table if exists feedback`.execute(db);
  await sql`alter table account drop column if exists operator_confirmed_at`.execute(db);
}
