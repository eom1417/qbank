import { sql } from 'kysely';
import type { Db } from '../../../platform/db/index.js';

/** A bank's questions waiting for the owner, with how many open reports each has (UI-10). */
async function reviewItems(db: Db, ownerId: string, bankId: string) {
  return db
    .selectFrom('question as q')
    .leftJoin('question_report as r', (join) =>
      join.onRef('r.question_id', '=', 'q.id').on('r.resolved_at', 'is', null),
    )
    .select([
      'q.id',
      'q.source_id',
      'q.source_page',
      'q.source_number',
      'q.source_seq',
      'q.kind',
      'q.stem',
      'q.status',
      'q.review_reasons',
      'q.answer_provenance',
      'q.deferred_at',
      sql<string>`count(r.id)`.as('open_reports'),
    ])
    .where('q.owner_id', '=', ownerId)
    .where('q.bank_id', '=', bankId)
    .where((eb) => eb.or([eb('q.status', '=', 'needs_review'), eb('r.id', 'is not', null)]))
    .groupBy('q.id')
    .execute();
}

export type ReviewItemRow = Awaited<ReturnType<typeof reviewItems>>[number];

/** A bank's questions in review, whole, to pick the safe ones for a bulk approval. */
const reviewQuestionsOfBank = (db: Db, ownerId: string, bankId: string) =>
  db
    .selectFrom('question')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('bank_id', '=', bankId)
    .where('status', '=', 'needs_review')
    .execute();

/** Every saved version of the owner's question, newest first (FR-09-008). */
const versionsOf = (db: Db, ownerId: string, questionId: string) =>
  db
    .selectFrom('question_version')
    .select(['version', 'snapshot', 'origin', 'created_at'])
    .where('owner_id', '=', ownerId)
    .where('question_id', '=', questionId)
    .orderBy('version', 'desc')
    .execute();

/** The owner's own tags on a question replace the earlier ones; suggestions are dropped. */
async function setTags(db: Db, ownerId: string, questionId: string, tagIds: readonly string[]) {
  await db
    .deleteFrom('question_tag')
    .where('owner_id', '=', ownerId)
    .where('question_id', '=', questionId)
    .execute();
  if (tagIds.length === 0) return;
  await db
    .insertInto('question_tag')
    .values(
      tagIds.map((tagId) => ({
        owner_id: ownerId,
        question_id: questionId,
        tag_id: tagId,
        origin: 'manual' as const,
      })),
    )
    .execute();
}

/** What a permanent deletion removes (FR-09-007): shown before the owner confirms. */
async function deletionImpact(db: Db, ownerId: string, questionId: string) {
  const count = (table: 'question_version' | 'media' | 'question_note' | 'question_report') =>
    db
      .selectFrom(table)
      .select(sql<string>`count(*)`.as('n'))
      .where('owner_id', '=', ownerId)
      .where('question_id', '=', questionId)
      .executeTakeFirstOrThrow()
      .then((row) => Number(row.n));
  return {
    versions: await count('question_version'),
    pictures: await count('media'),
    notes: await count('question_note'),
    reports: await count('question_report'),
  };
}

/** Deletes the question with its versions, tags, notes and reports; returns its pictures' blobs. */
async function deleteQuestion(db: Db, ownerId: string, questionId: string) {
  const media = await db
    .selectFrom('media')
    .select('blob_key')
    .where('owner_id', '=', ownerId)
    .where('question_id', '=', questionId)
    .execute();
  await db
    .deleteFrom('media')
    .where('owner_id', '=', ownerId)
    .where('question_id', '=', questionId)
    .execute();
  await db
    .deleteFrom('question_version')
    .where('owner_id', '=', ownerId)
    .where('question_id', '=', questionId)
    .execute();
  await db
    .deleteFrom('question')
    .where('owner_id', '=', ownerId)
    .where('id', '=', questionId)
    .execute();
  return media.map((row) => row.blob_key);
}

export function createReviewRepository(db: Db) {
  return {
    reviewItems: (ownerId: string, bankId: string) => reviewItems(db, ownerId, bankId),
    reviewQuestionsOfBank: (ownerId: string, bankId: string) =>
      reviewQuestionsOfBank(db, ownerId, bankId),
    versionsOf: (ownerId: string, questionId: string) => versionsOf(db, ownerId, questionId),
    setTags: (ownerId: string, questionId: string, tagIds: readonly string[]) =>
      setTags(db, ownerId, questionId, tagIds),
    deletionImpact: (ownerId: string, questionId: string) =>
      deletionImpact(db, ownerId, questionId),
    deleteQuestion: (ownerId: string, questionId: string) =>
      deleteQuestion(db, ownerId, questionId),
  };
}

export type ReviewRepository = ReturnType<typeof createReviewRepository>;
