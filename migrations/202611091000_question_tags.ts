import { sql, type Kysely } from 'kysely';

type Db = Kysely<unknown>;

// Immutable once applied: add a new migration instead of editing this one.
// Tags on questions (FR-11-004): suggested from the account's tag names, or set by the user.
export async function down(db: Db): Promise<void> {
  await db.schema.dropTable('question_tag').execute();
}

export async function up(db: Db): Promise<void> {
  await db.schema
    .createTable('question_tag')
    .addColumn('owner_id', 'uuid', (c) => c.notNull())
    .addColumn('tag_id', 'uuid', (c) => c.notNull().references('tag.id').onDelete('cascade'))
    .addColumn('question_id', 'uuid', (c) =>
      c.notNull().references('question.id').onDelete('cascade'),
    )
    .addColumn('origin', 'text', (c) => c.notNull().check(sql`origin in ('suggested', 'manual')`))
    .addPrimaryKeyConstraint('question_tag_pk', ['question_id', 'tag_id'])
    .execute();
}
