import { sql, type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
// M19 (DEC-33): the user's AI settles answers. `ai_verified` is an answer two independent
// solvers (or a decisive judge) agreed on; `file_answer` keeps the file's own answer when the AI
// overturned it (DEC-16) and `ai_note` the deciding reason. An import job remembers whether it
// improves questions (DEC-04) and which model plays each triage role; a `recheck` job triages a
// source's saved questions again without reading its file.
type Db = Kysely<unknown>;

const PROVENANCES = ['source', 'manual', 'ai_suggested', 'conflict', 'missing'];

const provenanceCheck = (values: string[]) =>
  sql`answer_provenance in (${sql.join(values.map((value) => sql.lit(value)))})`;

export async function up(db: Db): Promise<void> {
  await db.schema
    .alterTable('question')
    .dropConstraint('question_answer_provenance_check')
    .execute();
  await db.schema
    .alterTable('question')
    .addCheckConstraint(
      'question_answer_provenance_check',
      provenanceCheck([...PROVENANCES, 'ai_verified']),
    )
    .execute();
  await db.schema
    .alterTable('question')
    .addColumn('file_answer', 'text')
    .addColumn('ai_note', 'text')
    .execute();
  await db.schema
    .alterTable('import_job')
    .addColumn('ai_improve', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('ai_roles', 'jsonb')
    .execute();
  await setModes(db, ['verify', 'read', 'recheck']);
}

async function setModes(db: Db, modes: string[]) {
  await db.schema.alterTable('import_job').dropConstraint('import_job_ai_mode_check').execute();
  await db.schema
    .alterTable('import_job')
    .addCheckConstraint(
      'import_job_ai_mode_check',
      sql`ai_mode in (${sql.join(modes.map((mode) => sql.lit(mode)))})`,
    )
    .execute();
}

export async function down(db: Db): Promise<void> {
  await sql`delete from import_job where ai_mode = 'recheck'`.execute(db);
  await setModes(db, ['verify', 'read']);
  await db.schema
    .alterTable('import_job')
    .dropColumn('ai_improve')
    .dropColumn('ai_roles')
    .execute();
  await db.schema.alterTable('question').dropColumn('file_answer').dropColumn('ai_note').execute();
  await db.schema
    .alterTable('question')
    .dropConstraint('question_answer_provenance_check')
    .execute();
  await db.schema
    .alterTable('question')
    .addCheckConstraint('question_answer_provenance_check', provenanceCheck(PROVENANCES))
    .execute();
}
