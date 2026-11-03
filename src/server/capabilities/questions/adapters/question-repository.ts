import { sql, type Updateable } from 'kysely';
import type { Database } from '../../../platform/db/schema.js';
import type { Db } from '../../../platform/db/index.js';
import type { ChapterNames } from '../domain/classify.js';
import { withAnswerFile } from '../domain/answer-file.js';
import { occurrencesOf, type ImportedQuestion } from '../domain/imported.js';
import { existingAt, importedValues, type Place } from './question-writes.js';

export interface SourceCounts {
  sourceId: string;
  total: number;
  needsReview: number;
  eligible: number;
}

/** What a version keeps of a question: enough to show and restore it (FR-11-006, M7.7). */
const SNAPSHOT_FIELDS = [
  'kind',
  'stem',
  'options',
  'answer_letters',
  'answer_provenance',
  'answer_evidence',
  'explanation',
  'multi_select',
  'chapter_id',
  'topic_id',
  'status',
  'review_reasons',
] as const;

/** Saves the question's state as its next version when it changed; returns the version number. */
async function recordVersion(db: Db, questionId: string, origin: string, now: Date) {
  const row = await db
    .selectFrom('question')
    .select([...SNAPSHOT_FIELDS, 'owner_id', 'version'])
    .where('id', '=', questionId)
    .executeTakeFirstOrThrow();
  const snapshot = JSON.stringify(Object.fromEntries(SNAPSHOT_FIELDS.map((f) => [f, row[f]])));
  const last = await db
    .selectFrom('question_version')
    .select(['version', 'snapshot'])
    .where('question_id', '=', questionId)
    .orderBy('version', 'desc')
    .executeTakeFirst();
  if (last && JSON.stringify(last.snapshot) === snapshot) return;
  const version = last ? last.version + 1 : 1;
  await db
    .insertInto('question_version')
    .values({
      question_id: questionId,
      version,
      owner_id: row.owner_id,
      snapshot,
      origin,
      created_at: now,
    })
    .execute();
  await db.updateTable('question').set({ version }).where('id', '=', questionId).execute();
}

/**
 * Inserts or updates by (source, page, number): retrying an import never duplicates a question
 * (UAT-085), a fixed re-read replaces the earlier text, and what the user decided stays.
 */
async function saveImported(
  db: Db,
  newId: () => string,
  writes: { place: Place; chapters: readonly ChapterNames[]; now: Date },
  questions: readonly ImportedQuestion[],
) {
  const { place, chapters, now } = writes;
  const occurrences = occurrencesOf(questions);
  for (const [seq, question] of questions.entries()) {
    const occurrence = occurrences[seq] ?? 1;
    const existing = await existingAt(db, place, question, occurrence);
    const values = {
      ...importedValues(question, existing, chapters),
      source_seq: seq,
      updated_at: now,
    };
    const id = existing?.id ?? newId();
    if (existing) await db.updateTable('question').set(values).where('id', '=', id).execute();
    else
      await db
        .insertInto('question')
        .values({
          id,
          owner_id: place.ownerId,
          bank_id: place.bankId,
          source_id: place.sourceId,
          source_page: question.page,
          source_number: question.number,
          source_occurrence: occurrence,
          created_at: now,
          ...values,
        })
        .execute();
    await recordVersion(db, id, 'import', now);
  }
}

/** One question of the owner's (anyone else's is invisible). */
const findQuestion = (db: Db, ownerId: string, id: string) =>
  db
    .selectFrom('question')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('id', '=', id)
    .executeTakeFirst();

export type QuestionRow = NonNullable<Awaited<ReturnType<typeof findQuestion>>>;

/** Writes a change to the owner's question and records it as a new version. */
async function updateQuestion(
  db: Db,
  ownerId: string,
  id: string,
  changes: Updateable<Database['question']>,
  origin: { origin: string; now: Date },
) {
  await db
    .updateTable('question')
    .set({ ...changes, updated_at: origin.now })
    .where('owner_id', '=', ownerId)
    .where('id', '=', id)
    .execute();
  await recordVersion(db, id, origin.origin, origin.now);
}

/** A source's questions in reading order, to match a separate answer file (M6.3). */
const questionsOfSource = (db: Db, ownerId: string, sourceId: string) =>
  db
    .selectFrom('question')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('source_id', '=', sourceId)
    .orderBy('source_seq')
    .execute();

/** Applies a matched answer-file key to one question; false when it kept the user's answer. */
async function applyAnswerFile(
  db: Db,
  ownerId: string,
  questionId: string,
  letters: string[],
  now: Date,
) {
  const row = await db
    .selectFrom('question')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('id', '=', questionId)
    .executeTakeFirst();
  const changes = row ? withAnswerFile(row, letters) : null;
  if (!changes) return false;
  await db
    .updateTable('question')
    .set({ ...changes, updated_at: now })
    .where('id', '=', questionId)
    .execute();
  await recordVersion(db, questionId, 'answer_file', now);
  return true;
}

/** Questions per source of a bank, and how many wait for review. */
async function countsBySource(db: Db, ownerId: string, bankId: string): Promise<SourceCounts[]> {
  const rows = await db
    .selectFrom('question')
    .select([
      'source_id',
      sql<string>`count(*)`.as('total'),
      sql<string>`count(*) filter (where status = 'needs_review')`.as('review'),
      sql<string>`count(*) filter (where status = 'eligible')`.as('eligible'),
    ])
    .where('owner_id', '=', ownerId)
    .where('bank_id', '=', bankId)
    .groupBy('source_id')
    .execute();
  return rows.map((row) => ({
    sourceId: row.source_id,
    total: Number(row.total),
    needsReview: Number(row.review),
    eligible: Number(row.eligible),
  }));
}

/** Owner-scoped store of questions; an import writes each one once per source place. */
export function createQuestionRepository(
  db: Db,
  newId: () => string,
  chaptersOf: (ownerId: string, bankId: string) => Promise<readonly ChapterNames[]>,
) {
  return {
    saveImported: async (place: Place, questions: readonly ImportedQuestion[], now: Date) => {
      const chapters = await chaptersOf(place.ownerId, place.bankId);
      await saveImported(db, newId, { place, chapters, now }, questions);
    },
    findQuestion: (ownerId: string, id: string) => findQuestion(db, ownerId, id),
    updateQuestion: (
      ownerId: string,
      id: string,
      changes: Parameters<typeof updateQuestion>[3],
      origin: string,
      now: Date,
    ) => updateQuestion(db, ownerId, id, changes, { origin, now }),
    questionsOfSource: (ownerId: string, sourceId: string) =>
      questionsOfSource(db, ownerId, sourceId),
    applyAnswerFile: (ownerId: string, questionId: string, letters: string[], now: Date) =>
      applyAnswerFile(db, ownerId, questionId, letters, now),
    recordVersion: (questionId: string, origin: string, now: Date) =>
      recordVersion(db, questionId, origin, now),
    countsBySource: (ownerId: string, bankId: string) => countsBySource(db, ownerId, bankId),
  };
}

export type QuestionRepository = ReturnType<typeof createQuestionRepository>;
