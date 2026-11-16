import type { Db } from '../../../platform/db/index.js';
import { placePictures, type CaseView, type PlacedPictures } from '../../exam-rules/index.js';

// M34 P1: each studiable question's pictures by placement, with its shared case (Z8).

interface Asked {
  id: string;
  case_id: string | null;
}

export interface QuestionPictures {
  /** What the owner sees before the reveal: the question's own and any unplaced pictures. */
  shown: string[];
  placed: PlacedPictures;
}

async function casesOf(db: Db, ownerId: string, caseIds: readonly string[]) {
  const cases = new Map<string, CaseView>();
  if (caseIds.length === 0) return cases;
  const texts = await db
    .selectFrom('question_case')
    .select(['id', 'text'])
    .where('owner_id', '=', ownerId)
    .where('id', 'in', caseIds)
    .execute();
  for (const row of texts) cases.set(row.id, { text: row.text, pictureIds: [] });
  const pictures = await db
    .selectFrom('media as m')
    .innerJoin('question as q', 'q.id', 'm.question_id')
    .select(['m.id', 'q.case_id'])
    .where('m.owner_id', '=', ownerId)
    .where('m.placement', '=', 'case')
    .where('q.case_id', 'in', caseIds)
    .orderBy('q.source_seq')
    .orderBy('m.position')
    .execute();
  for (const row of pictures) if (row.case_id) cases.get(row.case_id)?.pictureIds.push(row.id);
  return cases;
}

/** Pictures of the given questions, in their order, sorted by where each belongs. */
export async function placedPicturesOf(db: Db, ownerId: string, asked: readonly Asked[]) {
  const result = new Map<string, QuestionPictures>();
  if (asked.length === 0) return result;
  const rows = await db
    .selectFrom('media')
    .select(['id', 'question_id', 'placement', 'option_letter'])
    .where('owner_id', '=', ownerId)
    .where(
      'question_id',
      'in',
      asked.map((question) => question.id),
    )
    .orderBy('position')
    .execute();
  const caseIds = [...new Set(asked.flatMap((question) => question.case_id ?? []))];
  const cases = await casesOf(db, ownerId, caseIds);
  for (const question of asked) {
    const own = rows.filter((row) => row.question_id === question.id);
    const sharedCase = question.case_id ? (cases.get(question.case_id) ?? null) : null;
    result.set(question.id, placePictures(own, sharedCase));
  }
  return result;
}

/** The given questions' pictures by placement, looked up by id alone (M34: one question at a time). */
export async function placedPicturesById(db: Db, ownerId: string, ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, QuestionPictures>();
  const asked = await db
    .selectFrom('question')
    .select(['id', 'case_id'])
    .where('owner_id', '=', ownerId)
    .where('id', 'in', ids)
    .execute();
  return placedPicturesOf(db, ownerId, asked);
}
