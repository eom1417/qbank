import type { Db } from '../../../platform/db/index.js';
import type { FoundPair } from '../domain/duplicates.js';

/** The bank's questions as duplicate detection reads them, oldest first. */
const bankTexts = (db: Db, ownerId: string, bankId: string) =>
  db
    .selectFrom('question')
    .select(['id', 'stem', 'options'])
    .where('owner_id', '=', ownerId)
    .where('bank_id', '=', bankId)
    .where('status', '!=', 'archived')
    .orderBy('created_at')
    .orderBy('source_seq')
    .execute();

/** Rows per insert: Postgres takes at most 65,535 parameters in one statement. */
const PAIRS_PER_INSERT = 1000;

async function savePairs(
  db: Db,
  ids: { ownerId: string; bankId: string },
  pairs: readonly FoundPair[],
  newId: () => string,
  now: Date,
) {
  for (let start = 0; start < pairs.length; start += PAIRS_PER_INSERT) {
    const rows = pairs.slice(start, start + PAIRS_PER_INSERT).map((pair) => ({
      id: newId(),
      owner_id: ids.ownerId,
      bank_id: ids.bankId,
      question_a: pair.a,
      question_b: pair.b,
      kind: pair.kind,
      similarity: pair.similarity,
      differences: pair.differences,
      decision: null,
      decided_at: null,
      created_at: now,
    }));
    await db
      .insertInto('question_pair')
      .values(rows)
      .onConflict((conflict) => conflict.columns(['question_a', 'question_b']).doNothing())
      .execute();
  }
}

/** One side of a pair as the comparison card shows it (UI-12, FR-10-003). */
const sideColumns = (alias: 'qa' | 'qb', source: 'sa' | 'sb') =>
  [
    `${alias}.id as ${alias}_id`,
    `${alias}.stem as ${alias}_stem`,
    `${alias}.options as ${alias}_options`,
    `${alias}.answer_letters as ${alias}_answers`,
    `${alias}.answer_provenance as ${alias}_provenance`,
    `${alias}.status as ${alias}_status`,
    `${alias}.source_page as ${alias}_page`,
    `${alias}.source_number as ${alias}_number`,
    `${source}.file_name as ${alias}_file`,
  ] as const;

/** The bank's pairs with both questions and their books, newest first. */
const pairsOfBank = (db: Db, ownerId: string, bankId: string) =>
  db
    .selectFrom('question_pair as p')
    .innerJoin('question as qa', 'qa.id', 'p.question_a')
    .innerJoin('question as qb', 'qb.id', 'p.question_b')
    .innerJoin('source as sa', 'sa.id', 'qa.source_id')
    .innerJoin('source as sb', 'sb.id', 'qb.source_id')
    .select(['p.id', 'p.kind', 'p.similarity', 'p.differences', 'p.decision'])
    .select(sideColumns('qa', 'sa'))
    .select(sideColumns('qb', 'sb'))
    .where('p.owner_id', '=', ownerId)
    .where('p.bank_id', '=', bankId)
    .orderBy('p.created_at', 'desc')
    .execute();

export type PairRow = Awaited<ReturnType<typeof pairsOfBank>>[number];

const findPair = (db: Db, ownerId: string, pairId: string) =>
  db
    .selectFrom('question_pair')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('id', '=', pairId)
    .executeTakeFirst();

const recordDecision = (
  db: Db,
  pairId: string,
  decision: 'kept_both' | 'reference' | 'excluded',
  now: Date,
) =>
  db
    .updateTable('question_pair')
    .set({ decision, decided_at: now })
    .where('id', '=', pairId)
    .execute();

/** A moved question's pairs belonged to its old bank; they go with the move. */
const forgetPairsOf = (db: Db, ownerId: string, questionIds: readonly string[]) =>
  questionIds.length === 0
    ? Promise.resolve()
    : db
        .deleteFrom('question_pair')
        .where('owner_id', '=', ownerId)
        .where((eb) =>
          eb.or([eb('question_a', 'in', questionIds), eb('question_b', 'in', questionIds)]),
        )
        .execute()
        .then(() => undefined);

/** Owner-scoped store of duplicate pairs and the owner's decisions (M8). */
export function createPairRepository(db: Db, newId: () => string) {
  return {
    bankTexts: (ownerId: string, bankId: string) => bankTexts(db, ownerId, bankId),
    savePairs: (ownerId: string, bankId: string, pairs: readonly FoundPair[], now: Date) =>
      savePairs(db, { ownerId, bankId }, pairs, newId, now),
    pairsOfBank: (ownerId: string, bankId: string) => pairsOfBank(db, ownerId, bankId),
    findPair: (ownerId: string, pairId: string) => findPair(db, ownerId, pairId),
    recordDecision: (pairId: string, decision: 'kept_both' | 'reference' | 'excluded', now: Date) =>
      recordDecision(db, pairId, decision, now),
    forgetPairsOf: (ownerId: string, questionIds: readonly string[]) =>
      forgetPairsOf(db, ownerId, questionIds),
  };
}

export type PairRepository = ReturnType<typeof createPairRepository>;
