// M30 (DEC-39): governed sharing. A channel becomes a share of a kind (agent, exam, practice)
// with one policy, a version that grows with each policy change, and a lifecycle (ended,
// archived). Every share keeps an append-only record of what happened to it, and exam/practice
// shares keep each person's attempt with a fixed snapshot of every question asked. None of it
// touches study: the owner's own progress never sees a share.
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

const STATEMENTS = [
  sql`alter table channel
    add column kind text not null default 'agent' check (kind in ('agent', 'exam', 'practice')),
    add column policy jsonb not null default '{}'::jsonb,
    add column version integer not null default 1,
    add column ended_at timestamptz,
    add column archived_at timestamptz`,
  sql`alter table channel drop constraint channel_batch_size_check`,
  sql`alter table channel add constraint channel_size_check check (batch_size between 1 and 200)`,
  sql`create table channel_event (
    id uuid primary key,
    channel_id uuid not null,
    owner_id uuid not null,
    at timestamptz not null,
    type text not null,
    version integer not null,
    detail jsonb not null default '{}'::jsonb,
    foreign key (owner_id, channel_id) references channel (owner_id, id) on delete cascade
  )`,
  sql`create index channel_event_channel on channel_event (channel_id, at)`,
  sql`create table channel_attempt (
    id uuid primary key,
    channel_id uuid not null,
    owner_id uuid not null,
    version integer not null,
    person_name text,
    person_ref text,
    person_key text not null,
    token_hash text not null unique,
    status text not null check (status in ('active', 'submitted')),
    ended_by text check (ended_by in ('person', 'time', 'owner')),
    position integer not null default 0,
    total integer not null check (total > 0),
    correct integer,
    started_at timestamptz not null,
    deadline_at timestamptz,
    submitted_at timestamptz,
    unique (owner_id, id),
    foreign key (owner_id, channel_id) references channel (owner_id, id) on delete cascade
  )`,
  sql`create index channel_attempt_person on channel_attempt (channel_id, person_key)`,
  sql`create table channel_attempt_item (
    attempt_id uuid not null references channel_attempt (id) on delete cascade,
    position integer not null,
    channel_id uuid not null,
    owner_id uuid not null,
    question_id uuid references question (id) on delete set null,
    snapshot jsonb not null,
    chosen text[],
    correct boolean,
    flagged boolean not null default false,
    opened_at timestamptz,
    answered_at timestamptz,
    primary key (attempt_id, position)
  )`,
  sql`create index channel_attempt_item_question on channel_attempt_item (channel_id, question_id)`,
  sql`create index channel_attempt_item_owner on channel_attempt_item (owner_id, question_id)`,
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const statement of STATEMENTS) await statement.execute(db);
}

/** Undoes the statements above in reverse: the new tables first, then the channel's columns. */
const REVERT = [
  sql`drop table channel_attempt_item, channel_attempt, channel_event`,
  sql`alter table channel drop constraint channel_size_check`,
  sql`alter table channel add constraint channel_batch_size_check
    check (batch_size between 1 and 10)`,
  sql`alter table channel
    drop column archived_at,
    drop column ended_at,
    drop column version,
    drop column policy,
    drop column kind`,
];

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const statement of REVERT) await statement.execute(db);
}
