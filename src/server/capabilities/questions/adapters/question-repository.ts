import { sql } from 'kysely';
import type { Db } from '../../../platform/db/index.js';
import { statusOf, type ImportedQuestion } from '../domain/imported.js';

interface Place {
  ownerId: string;
  bankId: string;
  sourceId: string;
}

export interface SourceCounts {
  sourceId: string;
  total: number;
  needsReview: number;
}

/**
 * Inserts or updates by (source, page, number): retrying an import never duplicates a question
 * (UAT-085), and a fixed re-read replaces the earlier text.
 */
async function saveImported(
  db: Db,
  newId: () => string,
  place: Place,
  questions: readonly ImportedQuestion[],
  now: Date,
) {
  for (const question of questions) {
    const values = {
      kind: question.kind,
      stem: question.stem,
      options: JSON.stringify(question.options),
      answer_letter: question.answer,
      answer_provenance: question.provenance,
      answer_evidence: question.evidence,
      status: statusOf(question),
      review_reasons: question.reasons,
      updated_at: now,
    };
    const place_ = { owner_id: place.ownerId, bank_id: place.bankId, source_id: place.sourceId };
    const key = { source_page: question.page, source_number: question.number };
    await db
      .insertInto('question')
      .values({ id: newId(), ...place_, ...key, created_at: now, ...values })
      .onConflict((conflict) =>
        conflict.columns(['source_id', 'source_page', 'source_number']).doUpdateSet(values),
      )
      .execute();
  }
}

/** Questions per source of a bank, and how many wait for review. */
async function countsBySource(db: Db, ownerId: string, bankId: string): Promise<SourceCounts[]> {
  const rows = await db
    .selectFrom('question')
    .select([
      'source_id',
      sql<string>`count(*)`.as('total'),
      sql<string>`count(*) filter (where status = 'needs_review')`.as('review'),
    ])
    .where('owner_id', '=', ownerId)
    .where('bank_id', '=', bankId)
    .groupBy('source_id')
    .execute();
  return rows.map((row) => ({
    sourceId: row.source_id,
    total: Number(row.total),
    needsReview: Number(row.review),
  }));
}

/** Owner-scoped store of questions; an import writes each one once per source place. */
export function createQuestionRepository(db: Db, newId: () => string) {
  return {
    saveImported: (place: Place, questions: readonly ImportedQuestion[], now: Date) =>
      saveImported(db, newId, place, questions, now),
    countsBySource: (ownerId: string, bankId: string) => countsBySource(db, ownerId, bankId),
  };
}
