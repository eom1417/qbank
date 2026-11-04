import type { Db } from '../../../platform/db/index.js';
import { exactKey } from '../domain/similarity.js';

/** Where a study session draws from (FR-12-001, FR-03-006); empty lists mean "any". */
export interface PoolFilter {
  bankIds: readonly string[];
  chapterIds?: readonly string[] | undefined;
  topicIds?: readonly string[] | undefined;
  sourceIds?: readonly string[] | undefined;
  tagIds?: readonly string[] | undefined;
  flaggedOnly?: boolean | undefined;
  favoritesOnly?: boolean | undefined;
}

type Option = { letter: string; label: string; text: string };

/** One studiable question: what a session snapshots, and its key for same-question checks. */
export interface PoolQuestion {
  id: string;
  bankId: string;
  chapterId: string | null;
  topicId: string | null;
  stem: string;
  options: Option[];
  answers: string[];
  multiSelect: boolean;
  explanation: string | null;
  version: number;
  pictureIds: string[];
  exactKey: string;
}

const some = (list: readonly string[] | undefined): list is readonly string[] =>
  list !== undefined && list.length > 0;

function poolQuery(db: Db, ownerId: string, filter: PoolFilter) {
  let query = db
    .selectFrom('question as q')
    .leftJoin('question_mark as m', (j) =>
      j.onRef('m.question_id', '=', 'q.id').on('m.owner_id', '=', ownerId),
    )
    .select([
      'q.id',
      'q.bank_id',
      'q.chapter_id',
      'q.topic_id',
      'q.stem',
      'q.options',
      'q.answer_letters',
      'q.multi_select',
      'q.explanation',
      'q.version',
    ])
    .where('q.owner_id', '=', ownerId)
    .where('q.status', '=', 'eligible')
    .where('q.bank_id', 'in', filter.bankIds);
  if (some(filter.chapterIds)) query = query.where('q.chapter_id', 'in', filter.chapterIds);
  if (some(filter.topicIds)) query = query.where('q.topic_id', 'in', filter.topicIds);
  if (some(filter.sourceIds)) query = query.where('q.source_id', 'in', filter.sourceIds);
  if (filter.flaggedOnly) query = query.where('m.flagged', '=', true);
  if (filter.favoritesOnly) query = query.where('m.favorite', '=', true);
  if (some(filter.tagIds)) {
    const tags = filter.tagIds;
    query = query.where((eb) =>
      eb.exists(
        eb
          .selectFrom('question_tag as t')
          .select('t.tag_id')
          .whereRef('t.question_id', '=', 'q.id')
          .where('t.tag_id', 'in', tags),
      ),
    );
  }
  return query.orderBy('q.created_at').orderBy('q.source_seq');
}

async function picturesOf(db: Db, ownerId: string, ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, string[]>();
  const rows = await db
    .selectFrom('media')
    .select(['id', 'question_id'])
    .where('owner_id', '=', ownerId)
    .where('question_id', 'in', ids)
    .orderBy('position')
    .execute();
  const byQuestion = new Map<string, string[]>();
  for (const row of rows)
    byQuestion.set(row.question_id, [...(byQuestion.get(row.question_id) ?? []), row.id]);
  return byQuestion;
}

/**
 * The owner's eligible questions in the chosen banks, chapters, topics, sources, tags and marks
 * (only `eligible` ones are ever studied, FR-11-002), each ready to snapshot.
 */
export async function studyPool(
  db: Db,
  ownerId: string,
  filter: PoolFilter,
): Promise<PoolQuestion[]> {
  if (filter.bankIds.length === 0) return [];
  const rows = await poolQuery(db, ownerId, filter).execute();
  const pictures = await picturesOf(
    db,
    ownerId,
    rows.map((row) => row.id),
  );
  return rows.map((row) => {
    const options = row.options as Option[];
    return {
      id: row.id,
      bankId: row.bank_id,
      chapterId: row.chapter_id,
      topicId: row.topic_id,
      stem: row.stem,
      options,
      answers: row.answer_letters,
      multiSelect: row.multi_select,
      explanation: row.explanation,
      version: row.version,
      pictureIds: pictures.get(row.id) ?? [],
      exactKey: exactKey({ id: row.id, stem: row.stem, options }),
    };
  });
}

type Mark = { flagged?: boolean | undefined; favorite?: boolean | undefined };

/** Only the marks the request names change; the other one stays as it was. */
const namedMarks = (mark: Mark) => ({
  ...(mark.flagged !== undefined ? { flagged: mark.flagged } : {}),
  ...(mark.favorite !== undefined ? { favorite: mark.favorite } : {}),
});

const setMark = (db: Db, ownerId: string, questionId: string, mark: Mark, now: Date) =>
  db
    .insertInto('question_mark')
    .values({
      owner_id: ownerId,
      question_id: questionId,
      flagged: mark.flagged ?? false,
      favorite: mark.favorite ?? false,
      updated_at: now,
    })
    .onConflict((c) =>
      c.columns(['owner_id', 'question_id']).doUpdateSet({ ...namedMarks(mark), updated_at: now }),
    )
    .execute();

/** The owner's flag and favourite on questions (FR-12-007); none set reads as false. */
export function createMarkRepository(db: Db) {
  return {
    setMark: (ownerId: string, questionId: string, mark: Mark, now: Date) =>
      setMark(db, ownerId, questionId, mark, now),
    marksOf: (ownerId: string, questionIds: readonly string[]) =>
      questionIds.length === 0
        ? Promise.resolve([])
        : db
            .selectFrom('question_mark')
            .selectAll()
            .where('owner_id', '=', ownerId)
            .where('question_id', 'in', questionIds)
            .execute(),
  };
}
