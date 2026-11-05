import { sql, type Updateable } from 'kysely';
import type { Database } from '../../../platform/db/schema.js';
import type { Db } from '../../../platform/db/index.js';
import type { ChapterNames } from '../domain/classify.js';
import { withAnswerFile } from '../domain/answer-file.js';
import { occurrencesOf, type ImportedQuestion } from '../domain/imported.js';
import { suggestTags } from '../domain/classify.js';
import {
  existingAt,
  freshText,
  importedValues,
  writeSuggestedTags,
  type Place,
} from './question-writes.js';

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
  'update_note',
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
  writes: { place: Place; names: BankNames; now: Date },
  questions: readonly ImportedQuestion[],
) {
  const { place, names, now } = writes;
  const occurrences = occurrencesOf(questions);
  const inserted: string[] = [];
  for (const [seq, question] of questions.entries()) {
    const occurrence = occurrences[seq] ?? 1;
    const existing = await existingAt(db, place, question, occurrence);
    const values = {
      ...importedValues(question, existing, names.chapters),
      source_seq: seq,
      updated_at: now,
    };
    const id = existing?.id ?? newId();
    if (!existing) inserted.push(id);
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
          ...freshText(question),
        })
        .execute();
    const text = `${question.stem} ${question.explanation ?? ''}`;
    await writeSuggestedTags(db, place.ownerId, id, suggestTags(text, names.tags));
    await recordVersion(db, id, 'import', now);
  }
  return inserted;
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

/**
 * A copy of the owner's question in another bank (FR-03-009): its own row, unplaced, with its
 * source kept and `copied_from` naming the original; its first version says `copy`.
 */
async function copyQuestion(
  db: Db,
  ownerId: string,
  id: string,
  bankId: string,
  copyId: string,
  now: Date,
) {
  const row = await findQuestion(db, ownerId, id);
  if (!row) throw new Error('question not found');
  const rest: Omit<typeof row, 'version'> & { version?: number } = { ...row };
  delete rest.version;
  await db
    .insertInto('question')
    .values({
      ...rest,
      id: copyId,
      bank_id: bankId,
      options: JSON.stringify(row.options),
      reimport_text: row.reimport_text === null ? null : JSON.stringify(row.reimport_text),
      study_note: row.study_note === null ? null : JSON.stringify(row.study_note),
      chapter_id: null,
      topic_id: null,
      classification: 'none',
      copied_from: id,
      duplicate_of: null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  const tags = await tagsOfQuestion(db, ownerId, id);
  if (tags.length > 0)
    await db
      .insertInto('question_tag')
      .values(
        tags.map((t) => ({
          question_id: copyId,
          tag_id: t.tag_id,
          owner_id: ownerId,
          origin: t.origin,
        })),
      )
      .execute();
  await recordVersion(db, copyId, 'copy', now);
  return copyId;
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

/** The bank's questions with a topic review, in reading order (DEC-34). */
const topicCardsOf = (db: Db, ownerId: string, bankId: string) =>
  db
    .selectFrom('question')
    .select(['id', 'stem', 'options', 'answer_letters', 'study_note'])
    .where('owner_id', '=', ownerId)
    .where('bank_id', '=', bankId)
    .where(sql<boolean>`study_note->>'kind' = 'topic_review'`)
    .where('status', 'not in', ['excluded', 'archived'])
    .orderBy('source_id')
    .orderBy('source_seq')
    .execute();

/** Owner-scoped store of questions; an import writes each one once per source place. */
/** The names the user gave their bank's chapters and topics, and their tags. */
interface BankNames {
  chapters: readonly ChapterNames[];
  tags: readonly { id: string; name: string }[];
}

/** Reads those names from the library (passed in: questions never reach into it). */
export interface NameLookups {
  chaptersOf(ownerId: string, bankId: string): Promise<readonly ChapterNames[]>;
  tagsOf(ownerId: string): Promise<readonly { id: string; name: string }[]>;
}

/** A question's tags and whether each was suggested or set by the user. */
const tagsOfQuestion = (db: Db, ownerId: string, questionId: string) =>
  db
    .selectFrom('question_tag')
    .select(['tag_id', 'origin'])
    .where('owner_id', '=', ownerId)
    .where('question_id', '=', questionId)
    .orderBy('tag_id')
    .execute();

export function createQuestionRepository(db: Db, newId: () => string, lookups: NameLookups) {
  return {
    saveImported: async (place: Place, questions: readonly ImportedQuestion[], now: Date) => {
      const names = {
        chapters: await lookups.chaptersOf(place.ownerId, place.bankId),
        tags: await lookups.tagsOf(place.ownerId),
      };
      return saveImported(db, newId, { place, names, now }, questions);
    },
    findQuestion: (ownerId: string, id: string) => findQuestion(db, ownerId, id),
    tagsOfQuestion: (ownerId: string, id: string) => tagsOfQuestion(db, ownerId, id),
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
    topicCardsOf: (ownerId: string, bankId: string) => topicCardsOf(db, ownerId, bankId),
    copyQuestion: (ownerId: string, id: string, bankId: string, copyId: string, now: Date) =>
      copyQuestion(db, ownerId, id, bankId, copyId, now),
  };
}

export type QuestionRepository = ReturnType<typeof createQuestionRepository>;
