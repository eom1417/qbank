// M34 P1 (DEC-43): every picture knows where it belongs, and a case shared by several questions is
// stored once. Additive only: existing pictures keep no placement and behave as before (Q65).
// Also the import pipeline's columns: per-account AI consent, the `pipeline` mode with its
// curriculum version, and two temporary tables (passages and cached AI steps, kept 7 days).
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

type Db = Kysely<unknown>;

const listCheck = (column: string, values: readonly string[]) =>
  sql`${sql.ref(column)} in (${sql.join(values.map((value) => sql.lit(value)))})`;

async function setCheck(db: Db, table: string, column: string, values: readonly string[]) {
  const name = `${table}_${column}_check`;
  await db.schema.alterTable(table).dropConstraint(name).execute();
  await db.schema.alterTable(table).addCheckConstraint(name, listCheck(column, values)).execute();
}

async function addCases(db: Db) {
  await db.schema
    .createTable('question_case')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull().references('account.id').onDelete('cascade'))
    .addColumn('source_id', 'uuid', (c) => c.references('source.id').onDelete('set null'))
    .addColumn('text', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .alterTable('question')
    .addColumn('case_id', 'uuid', (c) => c.references('question_case.id').onDelete('set null'))
    .execute();
  await db.schema.createIndex('question_case_id_idx').on('question').column('case_id').execute();
}

async function addPlacement(db: Db) {
  await db.schema
    .alterTable('media')
    .addColumn('placement', 'text', (c) =>
      c.check(listCheck('placement', ['question', 'option', 'explanation', 'case'])),
    )
    .addColumn('option_letter', 'text', (c) => c.check(sql`option_letter ~ '^[A-J]$'`))
    .execute();
  await db.schema
    .alterTable('media')
    .addCheckConstraint(
      'media_option_letter_placement_check',
      sql`case when placement = 'option' then option_letter is not null else option_letter is null end`,
    )
    .execute();
}

async function addTemporaryTables(db: Db) {
  await db.schema
    .createTable('import_block')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull().references('account.id').onDelete('cascade'))
    .addColumn('job_id', 'uuid', (c) => c.notNull().references('import_job.id').onDelete('cascade'))
    .addColumn('page', 'integer', (c) => c.notNull())
    .addColumn('ordinal', 'integer', (c) => c.notNull())
    .addColumn('kind', 'text', (c) => c.notNull())
    .addColumn('role', 'text')
    .addColumn('text', 'text')
    .addColumn('box', 'jsonb', (c) => c.notNull())
    .addColumn('expires_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now() + interval '7 days'`),
    )
    .addUniqueConstraint('import_block_job_page_ordinal_key', ['job_id', 'page', 'ordinal'])
    .execute();
  await db.schema
    .createTable('ai_step_cache')
    .addColumn('key', 'text', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull().references('account.id').onDelete('cascade'))
    .addColumn('lesson', 'text', (c) => c.notNull())
    .addColumn('model', 'text', (c) => c.notNull())
    .addColumn('reply', 'jsonb', (c) => c.notNull())
    .addColumn('input_tokens', 'integer', (c) => c.notNull())
    .addColumn('output_tokens', 'integer', (c) => c.notNull())
    .addColumn('expires_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now() + interval '7 days'`),
    )
    .execute();
}

export async function up(db: Db): Promise<void> {
  await addCases(db);
  await addPlacement(db);
  await addTemporaryTables(db);
  await sql`alter table account add column ai_consent_at timestamptz`.execute(db);
  await sql`alter table import_job add column curriculum_version text`.execute(db);
  await setCheck(db, 'import_job', 'ai_mode', ['verify', 'read', 'recheck', 'pipeline']);
  await setCheck(db, 'question_tag', 'origin', ['suggested', 'manual', 'import']);
}

// Rolling back drops what only M34 can hold: import-made tags and `pipeline` jobs are deleted.
export async function down(db: Db): Promise<void> {
  await sql`delete from question_tag where origin = 'import'`.execute(db);
  await setCheck(db, 'question_tag', 'origin', ['suggested', 'manual']);
  await sql`delete from import_job where ai_mode = 'pipeline'`.execute(db);
  await setCheck(db, 'import_job', 'ai_mode', ['verify', 'read', 'recheck']);
  await sql`alter table import_job drop column if exists curriculum_version`.execute(db);
  await sql`alter table account drop column if exists ai_consent_at`.execute(db);
  await db.schema.dropTable('ai_step_cache').ifExists().execute();
  await db.schema.dropTable('import_block').ifExists().execute();
  await sql`alter table media drop constraint if exists media_option_letter_placement_check`.execute(
    db,
  );
  await db.schema.alterTable('media').dropColumn('option_letter').dropColumn('placement').execute();
  await db.schema.alterTable('question').dropColumn('case_id').execute();
  await db.schema.dropTable('question_case').ifExists().execute();
}
