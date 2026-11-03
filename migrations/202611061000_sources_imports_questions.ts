import { sql, type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
// M4: uploaded sources, durable import jobs with per-page checkpoints, and extracted questions.
type Db = Kysely<unknown>;

const STAGES = [
  'queued',
  'reading',
  'extracting',
  'verifying',
  'matching',
  'completed',
  'needs_review',
  'partial_failure',
  'failed',
  'cancelled',
];
const inList = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));

async function sources(db: Db) {
  await db.schema
    .createTable('source')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull())
    .addColumn('bank_id', 'uuid', (c) => c.notNull())
    .addColumn('file_name', 'text', (c) => c.notNull())
    .addColumn('byte_size', 'bigint', (c) => c.notNull())
    .addColumn('sha256', 'text', (c) => c.notNull())
    .addColumn('blob_key', 'text')
    .addColumn('page_count', 'integer', (c) => c.notNull())
    .addColumn('page_from', 'integer', (c) => c.notNull())
    .addColumn('page_to', 'integer', (c) => c.notNull())
    .addColumn('language', 'text', (c) =>
      c.notNull().check(sql`language in ('auto', 'ar', 'en', 'mixed')`),
    )
    .addColumn('source_type', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addForeignKeyConstraint(
      'source_bank_fk',
      ['owner_id', 'bank_id'],
      'bank',
      ['owner_id', 'id'],
      (fk) => fk.onDelete('cascade'),
    )
    .addUniqueConstraint('source_owner_id_id_key', ['owner_id', 'id'])
    .addCheckConstraint(
      'source_page_range',
      sql`page_from >= 1 and page_from <= page_to and page_to <= page_count`,
    )
    .execute();
}

async function jobs(db: Db) {
  await db.schema
    .createTable('import_job')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull())
    .addColumn('source_id', 'uuid', (c) => c.notNull())
    .addColumn('stage', 'text', (c) => c.notNull().check(sql`stage in (${inList(STAGES)})`))
    .addColumn('pages_total', 'integer', (c) => c.notNull())
    .addColumn('pages_done', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('questions_found', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('questions_review', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('ai_provider_id', 'uuid')
    .addColumn('ai_outcome', 'text')
    .addColumn('error_code', 'text')
    .addColumn('attempts', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('locked_until', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull())
    .addColumn('finished_at', 'timestamptz')
    .addForeignKeyConstraint(
      'import_job_source_fk',
      ['owner_id', 'source_id'],
      'source',
      ['owner_id', 'id'],
      (fk) => fk.onDelete('cascade'),
    )
    .execute();
  await sql`create index import_job_runnable on import_job (created_at) where stage in ('queued', 'reading', 'extracting', 'verifying', 'matching')`.execute(
    db,
  );
  // One checkpoint per page: a retry skips pages already read (M4.7).
  await db.schema
    .createTable('import_page')
    .addColumn('job_id', 'uuid', (c) => c.notNull().references('import_job.id').onDelete('cascade'))
    .addColumn('page_no', 'integer', (c) => c.notNull())
    .addColumn('status', 'text', (c) =>
      c.notNull().check(sql`status in ('done', 'unreadable', 'failed')`),
    )
    .addColumn('reading', 'text', (c) => c.notNull().check(sql`reading in ('text', 'ocr')`))
    .addColumn('content', 'jsonb', (c) => c.notNull())
    .addColumn('warning', 'text')
    .addPrimaryKeyConstraint('import_page_pk', ['job_id', 'page_no'])
    .execute();
}

async function questions(db: Db) {
  await db.schema
    .createTable('question')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull())
    .addColumn('bank_id', 'uuid', (c) => c.notNull())
    .addColumn('source_id', 'uuid', (c) => c.notNull())
    .addColumn('source_page', 'integer', (c) => c.notNull())
    .addColumn('source_number', 'integer', (c) => c.notNull())
    .addColumn('kind', 'text', (c) => c.notNull().check(sql`kind in ('mcq', 'essay')`))
    .addColumn('stem', 'text', (c) => c.notNull())
    .addColumn('options', 'jsonb', (c) => c.notNull())
    .addColumn('answer_letter', 'text')
    .addColumn('answer_provenance', 'text', (c) =>
      c
        .notNull()
        .check(
          sql`answer_provenance in ('source', 'manual', 'ai_suggested', 'conflict', 'missing')`,
        ),
    )
    .addColumn('answer_evidence', 'text')
    .addColumn('status', 'text', (c) =>
      c
        .notNull()
        .check(sql`status in ('detected', 'needs_review', 'eligible', 'excluded', 'archived')`),
    )
    .addColumn('review_reasons', sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'`))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull())
    .addForeignKeyConstraint(
      'question_bank_fk',
      ['owner_id', 'bank_id'],
      'bank',
      ['owner_id', 'id'],
      (fk) => fk.onDelete('cascade'),
    )
    .addForeignKeyConstraint(
      'question_source_fk',
      ['owner_id', 'source_id'],
      'source',
      ['owner_id', 'id'],
      (fk) => fk.onDelete('cascade'),
    )
    // A retried import updates the same question instead of adding a copy (UAT-085).
    .addUniqueConstraint('question_source_place_key', ['source_id', 'source_page', 'source_number'])
    .execute();
  await sql`create index question_bank on question (owner_id, bank_id)`.execute(db);
}

export async function up(db: Db): Promise<void> {
  await sources(db);
  await jobs(db);
  await questions(db);
}

export async function down(db: Db): Promise<void> {
  for (const table of ['question', 'import_page', 'import_job', 'source']) {
    await db.schema.dropTable(table).execute();
  }
}
