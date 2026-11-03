import { sql, type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
// M5: figures and tables cropped from a source, each tied to its question in order.
type Db = Kysely<unknown>;

export async function up(db: Db): Promise<void> {
  await db.schema
    .createTable('media')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull())
    .addColumn('source_id', 'uuid', (c) => c.notNull())
    .addColumn('question_id', 'uuid', (c) =>
      c.notNull().references('question.id').onDelete('cascade'),
    )
    .addColumn('position', 'integer', (c) => c.notNull())
    .addColumn('page', 'integer', (c) => c.notNull())
    .addColumn('box', 'jsonb', (c) => c.notNull())
    .addColumn('kind', 'text', (c) => c.notNull().check(sql`kind in ('figure', 'table')`))
    .addColumn('modality', 'text')
    .addColumn('link', 'text', (c) => c.notNull().check(sql`link in ('certain', 'uncertain')`))
    .addColumn('blob_key', 'text', (c) => c.notNull())
    .addColumn('width', 'integer', (c) => c.notNull())
    .addColumn('height', 'integer', (c) => c.notNull())
    .addColumn('quality', 'jsonb', (c) => c.notNull())
    .addColumn('low_quality', 'boolean', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addForeignKeyConstraint(
      'media_source_fk',
      ['owner_id', 'source_id'],
      'source',
      ['owner_id', 'id'],
      (fk) => fk.onDelete('cascade'),
    )
    .addUniqueConstraint('media_question_position_key', ['question_id', 'position'])
    .execute();
  await db.schema.createIndex('media_source_idx').on('media').columns(['source_id']).execute();
}

export async function down(db: Db): Promise<void> {
  await db.schema.dropTable('media').execute();
}
