// M34 P6: what the review editor and the import report need. Each unit kept in `import_block`
// knows its image class and its question; a pipeline job keeps its starting tier (Q14) and what
// the pipeline learnt of the file (family, unknown pages: Q59); and the weekly measurement of
// the approved models on the built-in reference set (Q15). Additive only.
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('import_block')
    .addColumn('image_class', 'text')
    .addColumn('question_seq', 'integer')
    .execute();
  await db.schema
    .alterTable('import_job')
    .addColumn('ai_tier', 'text', (c) => c.check(sql`ai_tier in ('light', 'strong')`))
    .addColumn('pipeline_facts', 'jsonb')
    .execute();
  await db.schema
    .createTable('model_measurement')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('lesson', 'text', (c) => c.notNull())
    .addColumn('provider_kind', 'text', (c) => c.notNull())
    .addColumn('model', 'text', (c) => c.notNull())
    .addColumn('correct', 'integer', (c) => c.notNull())
    .addColumn('total', 'integer', (c) => c.notNull())
    .addColumn('passed', 'boolean', (c) => c.notNull())
    .addColumn('ran_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('model_measurement_model_idx')
    .on('model_measurement')
    .columns(['lesson', 'model', 'ran_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('model_measurement').ifExists().execute();
  await sql`alter table import_job drop column if exists pipeline_facts`.execute(db);
  await sql`alter table import_job drop column if exists ai_tier`.execute(db);
  await sql`alter table import_block drop column if exists question_seq`.execute(db);
  await sql`alter table import_block drop column if exists image_class`.execute(db);
}
