import { sql } from 'kysely';
import type { Db } from '../../../platform/db/index.js';
import { NO_ID } from '../../../platform/ids.js';

const n = (value: string | number | null | undefined) => Number(value ?? 0);

/**
 * The owner's questions by where they stand (FR-16-001): detected, waiting, eligible and
 * excluded are separate, and so are duplicates waiting for a decision (never mixed with eligible).
 */
async function statusCounts(db: Db, ownerId: string, bankIds: readonly string[] | null) {
  let query = db
    .selectFrom('question')
    .select([
      sql<string>`count(*)`.as('total'),
      sql<string>`count(*) filter (where status = 'detected')`.as('detected'),
      sql<string>`count(*) filter (where status = 'needs_review')`.as('review'),
      sql<string>`count(*) filter (where status = 'eligible')`.as('eligible'),
      sql<string>`count(*) filter (where status = 'excluded')`.as('excluded'),
      sql<string>`count(*) filter (where 'duplicate' = any(review_reasons))`.as('duplicates'),
    ])
    .where('owner_id', '=', ownerId);
  if (bankIds) query = query.where('bank_id', 'in', bankIds.length > 0 ? bankIds : [NO_ID]);
  const row = await query.executeTakeFirstOrThrow();
  return {
    total: n(row.total),
    detected: n(row.detected),
    needsReview: n(row.review),
    eligible: n(row.eligible),
    excluded: n(row.excluded),
    duplicates: n(row.duplicates),
  };
}

/**
 * What each source's import gave (FR-16-007, UAT-067): found, eligible, waiting, duplicates,
 * missing answers and pictures, each on its own; reading a page is not teaching anything.
 */
async function qualityBySource(db: Db, ownerId: string, bankId: string) {
  const rows = await db
    .selectFrom('source as s')
    .leftJoin('question as q', 'q.source_id', 's.id')
    .select([
      's.id',
      's.file_name',
      sql<string>`count(q.id)`.as('found'),
      sql<string>`count(q.id) filter (where q.status = 'eligible')`.as('eligible'),
      sql<string>`count(q.id) filter (where q.status = 'needs_review')`.as('review'),
      sql<string>`count(q.id) filter (where 'duplicate' = any(q.review_reasons))`.as('duplicates'),
      sql<string>`count(q.id) filter (where 'no_answer' = any(q.review_reasons))`.as('no_answer'),
      sql<string>`(select count(*) from media m where m.source_id = s.id)`.as('pictures'),
    ])
    .where('s.owner_id', '=', ownerId)
    .where('s.bank_id', '=', bankId)
    .where('s.source_type', '!=', 'answer_key')
    .groupBy('s.id')
    .orderBy('s.created_at', 'desc')
    .execute();
  return rows.map((row) => ({
    sourceId: row.id,
    fileName: row.file_name,
    found: n(row.found),
    eligible: n(row.eligible),
    needsReview: n(row.review),
    duplicates: n(row.duplicates),
    missingAnswers: n(row.no_answer),
    pictures: n(row.pictures),
  }));
}

/** Questions with a study report still open: a possible question problem, not a weak student. */
const reportedQuestionIds = async (db: Db, ownerId: string) =>
  new Set(
    (
      await db
        .selectFrom('question_report')
        .select('question_id')
        .where('owner_id', '=', ownerId)
        .where('resolved_at', 'is', null)
        .execute()
    ).map((row) => row.question_id),
  );

export function createInsights(db: Db) {
  return {
    statusCounts: (ownerId: string, bankIds: readonly string[] | null) =>
      statusCounts(db, ownerId, bankIds),
    qualityBySource: (ownerId: string, bankId: string) => qualityBySource(db, ownerId, bankId),
    reportedQuestionIds: (ownerId: string) => reportedQuestionIds(db, ownerId),
  };
}
