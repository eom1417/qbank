// M23 (DEC-36): publishing channels. A channel hands an outside agent batches of a bank's ready
// questions, each question once per cycle, and keeps its own record of what it sent and how its
// recipients answered. None of it touches study (study_session, study_item, question_mark):
// the owner's own progress never sees a channel, and a channel never sees it.
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

const STATEMENTS = [
  sql`create table channel (
    id uuid primary key,
    owner_id uuid not null,
    bank_id uuid not null,
    name text not null check (length(name) between 1 and 100),
    chapter_ids uuid[] not null default '{}',
    batch_size integer not null check (batch_size between 1 and 10),
    when_done text not null check (when_done in ('restart', 'stop')),
    key_hash text not null unique,
    key_prefix text not null,
    paused boolean not null default false,
    cycle integer not null default 1,
    created_at timestamptz not null,
    last_used_at timestamptz,
    unique (owner_id, id),
    foreign key (owner_id, bank_id) references bank (owner_id, id) on delete cascade
  )`,
  sql`create index channel_bank on channel (owner_id, bank_id)`,
  sql`create table channel_batch (
    id uuid primary key,
    channel_id uuid not null,
    owner_id uuid not null,
    batch_key text,
    cycle integer not null,
    created_at timestamptz not null,
    unique (channel_id, batch_key),
    foreign key (owner_id, channel_id) references channel (owner_id, id) on delete cascade
  )`,
  sql`create table channel_delivery (
    id uuid primary key,
    batch_id uuid not null references channel_batch (id) on delete cascade,
    channel_id uuid not null,
    owner_id uuid not null,
    question_id uuid not null references question (id) on delete cascade,
    cycle integer not null,
    position integer not null,
    sent_at timestamptz not null,
    unique (channel_id, cycle, question_id),
    foreign key (owner_id, channel_id) references channel (owner_id, id) on delete cascade
  )`,
  sql`create table channel_answer (
    delivery_id uuid not null references channel_delivery (id) on delete cascade,
    channel_id uuid not null,
    owner_id uuid not null,
    recipient_hash text not null,
    choice text[] not null,
    correct boolean not null,
    answered_at timestamptz not null,
    primary key (delivery_id, recipient_hash),
    foreign key (owner_id, channel_id) references channel (owner_id, id) on delete cascade
  )`,
  sql`create index channel_answer_channel on channel_answer (channel_id)`,
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const statement of STATEMENTS) await statement.execute(db);
}

/** Children first: every table below points at the ones after it. */
const TABLES = ['channel_answer', 'channel_delivery', 'channel_batch', 'channel'] as const;

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of TABLES) await db.schema.dropTable(table).execute();
}
