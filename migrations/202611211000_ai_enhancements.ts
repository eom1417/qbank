import { sql, type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
// M20 (DEC-34): "improve questions with AI" is a set of separate choices, kept per import job in
// `ai_enhance` (it replaces the single `ai_improve` switch: on meant verify, four options and
// polish). A question records what the AI changed (`ai_changes`, shown as badges) and its study
// note (`study_note`: topic review, why each option, sources), kept apart from the book's text.
type Db = Kysely<unknown>;

export async function up(db: Db): Promise<void> {
  await db.schema.alterTable('import_job').addColumn('ai_enhance', 'jsonb').execute();
  await sql`update import_job set ai_enhance = jsonb_build_object(
      'verifyAnswers', true, 'completeOptions', case when ai_improve then 4 else 0 end,
      'polishText', ai_improve, 'topicReview', false, 'explainOptions', false,
      'updateNotes', false, 'classify', false, 'duplicates', false)
    where ai_provider_id is not null`.execute(db);
  await db.schema.alterTable('import_job').dropColumn('ai_improve').execute();
  await db.schema
    .alterTable('question')
    .addColumn('ai_changes', sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn('study_note', 'jsonb')
    .execute();
}

export async function down(db: Db): Promise<void> {
  await db.schema
    .alterTable('question')
    .dropColumn('ai_changes')
    .dropColumn('study_note')
    .execute();
  await db.schema
    .alterTable('import_job')
    .addColumn('ai_improve', 'boolean', (c) => c.notNull().defaultTo(false))
    .execute();
  await sql`update import_job set ai_improve = coalesce((ai_enhance->>'polishText')::boolean, false)`.execute(
    db,
  );
  await db.schema.alterTable('import_job').dropColumn('ai_enhance').execute();
}
