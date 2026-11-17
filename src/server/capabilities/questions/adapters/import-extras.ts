import type { Db } from '../../../platform/db/index.js';
import { occurrencesOf } from '../domain/imported.js';
import type { Place } from './question-writes.js';

// M34 P5: what a pipeline import adds to its saved questions: shared cases stored once (Z8,
// Q66) and the exam and year tags it read (Q67, origin `import`).

/** Cases and tags by the question's index in the import's list. */
export interface ImportExtras {
  /** A case's text once, and the questions that share it. */
  cases: { text: string; questions: number[] }[];
  /** Tag names (`exam:…`, `year:…`) per question. */
  tags: { question: number; names: string[] }[];
}

/** The account's tags by these names, created when missing: lower-case name → id. */
export type EnsureTags = (
  ownerId: string,
  names: readonly string[],
) => Promise<Map<string, string>>;

interface Writer {
  db: Db;
  newId: () => string;
  ensureTags: EnsureTags;
}

/** Each listed question's saved id, by its page, number and occurrence in the source. */
async function savedIds(
  db: Db,
  place: Place,
  questions: readonly { page: number; number: number }[],
): Promise<(string | null)[]> {
  const rows = await db
    .selectFrom('question')
    .select(['id', 'source_page', 'source_number', 'source_occurrence'])
    .where('owner_id', '=', place.ownerId)
    .where('source_id', '=', place.sourceId)
    .where('copied_from', 'is', null)
    .execute();
  const byKey = new Map(
    rows.map((row) => [`${row.source_page}:${row.source_number}:${row.source_occurrence}`, row.id]),
  );
  const occurrences = occurrencesOf(questions);
  return questions.map(
    (q, index) => byKey.get(`${q.page}:${q.number}:${occurrences[index] ?? 1}`) ?? null,
  );
}

const idsOf = (ids: readonly (string | null)[], indexes: readonly number[]) =>
  indexes.flatMap((index) => ids[index] ?? []);

/** The source's earlier cases go (their questions' `case_id` is cleared), then the new ones. */
async function writeCases(
  { db, newId }: Writer,
  place: Place,
  ids: (string | null)[],
  extras: ImportExtras,
) {
  await db
    .deleteFrom('question_case')
    .where('owner_id', '=', place.ownerId)
    .where('source_id', '=', place.sourceId)
    .execute();
  for (const shared of extras.cases) {
    const members = idsOf(ids, shared.questions);
    if (members.length === 0) continue;
    const id = newId();
    await db
      .insertInto('question_case')
      .values({ id, owner_id: place.ownerId, source_id: place.sourceId, text: shared.text })
      .execute();
    await db
      .updateTable('question')
      .set({ case_id: id })
      .where('owner_id', '=', place.ownerId)
      .where('id', 'in', members)
      .execute();
  }
}

/** The import's earlier tags on the source's questions go; manual and suggested ones stay. */
async function writeTags(
  db: Db,
  place: Place,
  ids: (string | null)[],
  tags: { question: number; tagIds: string[] }[],
) {
  const all = ids.filter((id): id is string => id !== null);
  if (all.length > 0)
    await db
      .deleteFrom('question_tag')
      .where('owner_id', '=', place.ownerId)
      .where('origin', '=', 'import')
      .where('question_id', 'in', all)
      .execute();
  const rows = tags.flatMap(({ question, tagIds }) => {
    const questionId = ids[question];
    return questionId
      ? tagIds.map((tag_id) => ({
          question_id: questionId,
          tag_id,
          owner_id: place.ownerId,
          origin: 'import' as const,
        }))
      : [];
  });
  if (rows.length === 0) return;
  await db
    .insertInto('question_tag')
    .values(rows)
    .onConflict((conflict) => conflict.columns(['question_id', 'tag_id']).doNothing())
    .execute();
}

/** Writes an import's cases and tags onto its saved questions (a re-import replaces them). */
export async function saveImportExtras(
  writer: Writer,
  place: Place,
  questions: readonly { page: number; number: number }[],
  extras: ImportExtras,
) {
  const ids = await savedIds(writer.db, place, questions);
  await writeCases(writer, place, ids, extras);
  const names = [...new Set(extras.tags.flatMap((entry) => entry.names))];
  const byName =
    names.length > 0 ? await writer.ensureTags(place.ownerId, names) : new Map<string, string>();
  const tags = extras.tags.map(({ question, names: own }) => ({
    question,
    tagIds: own.flatMap((name) => byName.get(name.toLocaleLowerCase()) ?? []),
  }));
  await writeTags(writer.db, place, ids, tags);
}
