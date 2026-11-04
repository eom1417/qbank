// M7 review: deferring a question, a modern-information note kept apart from the book's answer
// (FR-24-002), private review notes (FR-09-009) and study reports (FR-09-010).
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

type Db = Kysely<unknown>;

/** A table of the owner's things about one question: deleted with the account or question. */
const aboutQuestion = (db: Db, table: string) =>
  db.schema
    .createTable(table)
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull().references('account.id').onDelete('cascade'))
    .addColumn('question_id', 'uuid', (c) =>
      c.notNull().references('question.id').onDelete('cascade'),
    );

const byOwner = (db: Db, table: string) =>
  db.schema.createIndex(`${table}_owner`).on(table).columns(['owner_id', 'question_id']).execute();

export async function up(db: Db): Promise<void> {
  await aboutQuestion(db, 'question_note')
    .addColumn('body', 'text', (c) => c.notNull())
    .addColumn('labels', sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'`))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await byOwner(db, 'question_note');
  await aboutQuestion(db, 'question_report')
    .addColumn('kind', 'text', (c) =>
      c.notNull().check(sql`kind in ('ambiguous', 'image_missing', 'wrong_key', 'other')`),
    )
    .addColumn('comment', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addColumn('resolved_at', 'timestamptz')
    .execute();
  await byOwner(db, 'question_report');
  await db.schema.alterTable('question').addColumn('deferred_at', 'timestamptz').execute();
  await db.schema.alterTable('question').addColumn('update_note', 'text').execute();
}

export async function down(db: Db): Promise<void> {
  await db.schema.dropTable('question_report').execute();
  await db.schema.dropTable('question_note').execute();
  await db.schema.alterTable('question').dropColumn('update_note').execute();
  await db.schema.alterTable('question').dropColumn('deferred_at').execute();
}
