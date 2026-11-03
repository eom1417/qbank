import { sql, type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
// M6: answer keys (several letters for multiple-select), author explanations, taxonomy and
// difficulty with their provenance, accepted AI answers, question versions, answer-key files
// and how long an original is kept.
type Db = Kysely<unknown>;

async function questionColumns(db: Db) {
  await db.schema
    .alterTable('question')
    .addColumn('answer_letters', sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'`))
    .addColumn('multi_select', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('explanation', 'text')
    .addColumn('chapter_id', 'uuid', (c) => c.references('chapter.id').onDelete('set null'))
    .addColumn('topic_id', 'uuid', (c) => c.references('topic.id').onDelete('set null'))
    .addColumn('classification', 'text', (c) =>
      c
        .notNull()
        .defaultTo('none')
        .check(sql`classification in ('none', 'suggested', 'manual')`),
    )
    .addColumn('difficulty_kind', 'text', (c) =>
      c
        .notNull()
        .defaultTo('unset')
        .check(sql`difficulty_kind in ('unset', 'manual', 'inferred')`),
    )
    .addColumn('difficulty', 'smallint', (c) => c.check(sql`difficulty between 1 and 5`))
    .addColumn('ai_answer_accepted_at', 'timestamptz')
    .addColumn('version', 'integer', (c) => c.notNull().defaultTo(1))
    .execute();
  await sql`update question set answer_letters = array[answer_letter] where answer_letter is not null`.execute(
    db,
  );
}

export async function up(db: Db): Promise<void> {
  await questionColumns(db);
  await db.schema
    .createTable('question_version')
    .addColumn('question_id', 'uuid', (c) =>
      c.notNull().references('question.id').onDelete('cascade'),
    )
    .addColumn('version', 'integer', (c) => c.notNull())
    .addColumn('owner_id', 'uuid', (c) => c.notNull())
    .addColumn('snapshot', 'jsonb', (c) => c.notNull())
    .addColumn('origin', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addPrimaryKeyConstraint('question_version_pk', ['question_id', 'version'])
    .execute();
  await db.schema
    .alterTable('source')
    .addColumn('answers_for_source_id', 'uuid', (c) =>
      c.references('source.id').onDelete('cascade'),
    )
    .addColumn('original_expires_at', 'timestamptz')
    .execute();
}

export async function down(db: Db): Promise<void> {
  await db.schema.dropTable('question_version').execute();
  await db.schema
    .alterTable('source')
    .dropColumn('answers_for_source_id')
    .dropColumn('original_expires_at')
    .execute();
  await db.schema
    .alterTable('question')
    .dropColumn('answer_letters')
    .dropColumn('multi_select')
    .dropColumn('explanation')
    .dropColumn('chapter_id')
    .dropColumn('topic_id')
    .dropColumn('classification')
    .dropColumn('difficulty_kind')
    .dropColumn('difficulty')
    .dropColumn('ai_answer_accepted_at')
    .dropColumn('version')
    .execute();
}
