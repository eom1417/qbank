import { type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
// M6: numbering restarts per chapter, so page + number is not unique: a question is identified
// by its page, number and which occurrence of that number it is on the page; `source_seq` keeps
// the reading order for matching answer files.
type Db = Kysely<unknown>;

export async function up(db: Db): Promise<void> {
  await db.schema
    .alterTable('question')
    .addColumn('source_occurrence', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('source_seq', 'integer', (c) => c.notNull().defaultTo(0))
    .execute();
  await db.schema.alterTable('question').dropConstraint('question_source_place_key').execute();
  await db.schema
    .alterTable('question')
    .addUniqueConstraint('question_source_place_key', [
      'source_id',
      'source_page',
      'source_number',
      'source_occurrence',
    ])
    .execute();
}

export async function down(db: Db): Promise<void> {
  await db.schema.alterTable('question').dropConstraint('question_source_place_key').execute();
  await db.schema
    .alterTable('question')
    .addUniqueConstraint('question_source_place_key', ['source_id', 'source_page', 'source_number'])
    .execute();
  await db.schema
    .alterTable('question')
    .dropColumn('source_occurrence')
    .dropColumn('source_seq')
    .execute();
}
