// M8 duplicates: pairs of the same or similar questions with the owner's decision (FR-10-001…004),
// the owner's edits protected from a re-import (FR-10-006), and copies between banks (FR-03-009).
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

type Db = Kysely<unknown>;

export async function up(db: Db): Promise<void> {
  await sql`alter table question
    add column owner_edited_at timestamptz,
    add column reimport_text jsonb,
    add column copied_from uuid references question(id) on delete set null,
    add column duplicate_of uuid references question(id) on delete set null`.execute(db);
  await db.schema
    .createTable('question_pair')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull().references('account.id').onDelete('cascade'))
    .addColumn('bank_id', 'uuid', (c) => c.notNull())
    .addColumn('question_a', 'uuid', (c) =>
      c.notNull().references('question.id').onDelete('cascade'),
    )
    .addColumn('question_b', 'uuid', (c) =>
      c.notNull().references('question.id').onDelete('cascade'),
    )
    .addColumn('kind', 'text', (c) => c.notNull().check(sql`kind in ('exact', 'similar')`))
    .addColumn('similarity', 'real', (c) => c.notNull())
    .addColumn('differences', sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'`))
    .addColumn('decision', 'text', (c) =>
      c.check(sql`decision in ('kept_both', 'reference', 'excluded')`),
    )
    .addColumn('decided_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addUniqueConstraint('question_pair_once', ['question_a', 'question_b'])
    .execute();
  await db.schema
    .createIndex('question_pair_bank')
    .on('question_pair')
    .columns(['owner_id', 'bank_id'])
    .execute();
}

export async function down(db: Db): Promise<void> {
  await db.schema.dropTable('question_pair').execute();
  await sql`alter table question
    drop column duplicate_of,
    drop column copied_from,
    drop column reimport_text,
    drop column owner_edited_at`.execute(db);
}
