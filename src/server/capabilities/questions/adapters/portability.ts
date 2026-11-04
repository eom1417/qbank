import { sql } from 'kysely';
import type { Db } from '../../../platform/db/index.js';
import { NO_ID } from '../../../platform/ids.js';
import type { AnswerProvenance } from '../domain/imported.js';

/** A bank's questions for an export, optionally only some chapters (FR-18-003, UAT-071). */
async function questionsOfBank(
  db: Db,
  ownerId: string,
  bankId: string,
  chapterIds: readonly string[] | null,
) {
  let query = db
    .selectFrom('question')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('bank_id', '=', bankId)
    .where('status', '!=', 'archived');
  if (chapterIds)
    query = query.where('chapter_id', 'in', chapterIds.length > 0 ? chapterIds : [NO_ID]);
  return query.orderBy('source_id').orderBy('source_seq').execute();
}

const byQuestion = <T extends { question_id: string }>(rows: readonly T[]) => {
  const grouped = new Map<string, T[]>();
  for (const row of rows)
    grouped.set(row.question_id, [...(grouped.get(row.question_id) ?? []), row]);
  return grouped;
};

/** Everything an export carries per question: tags, notes and pictures (with their blobs). */
async function extrasOf(db: Db, ownerId: string, ids: readonly string[]) {
  const scope = ids.length > 0 ? ids : [NO_ID];
  const [tags, notes, media] = await Promise.all([
    db
      .selectFrom('question_tag')
      .select(['question_id', 'tag_id'])
      .where('owner_id', '=', ownerId)
      .where('question_id', 'in', scope)
      .execute(),
    db
      .selectFrom('question_note')
      .select(['question_id', 'body', 'labels'])
      .where('owner_id', '=', ownerId)
      .where('question_id', 'in', scope)
      .execute(),
    db
      .selectFrom('media')
      .selectAll()
      .where('owner_id', '=', ownerId)
      .where('question_id', 'in', scope)
      .orderBy('position')
      .execute(),
  ]);
  return { tags: byQuestion(tags), notes: byQuestion(notes), media: byQuestion(media) };
}

/** One question to restore, with the new ids it maps to (FR-18-005). */
export interface RestoredQuestion {
  sourceId: string;
  page: number;
  number: number;
  occurrence: number;
  seq: number;
  kind: 'mcq' | 'essay';
  stem: string;
  options: { letter: string; label: string; text: string }[];
  answers: string[];
  provenance: AnswerProvenance;
  evidence: string | null;
  explanation: string | null;
  updateNote: string | null;
  multiSelect: boolean;
  chapterId: string | null;
  topicId: string | null;
  status: 'detected' | 'needs_review' | 'eligible' | 'excluded';
  reasons: string[];
  tagIds: string[];
  notes: { body: string; labels: string[] }[];
  pictures: {
    blobKey: string;
    page: number;
    position: number;
    kind: 'figure' | 'table';
    width: number;
    height: number;
  }[];
}

type Owner = { ownerId: string; bankId: string; now: Date };

async function insertTagsAndNotes(
  db: Db,
  owner: Owner,
  id: string,
  q: RestoredQuestion,
  newId: () => string,
) {
  const tags = q.tagIds.map((tag_id) => ({
    question_id: id,
    tag_id,
    owner_id: owner.ownerId,
    origin: 'manual' as const,
  }));
  if (tags.length > 0) await db.insertInto('question_tag').values(tags).execute();
  for (const note of q.notes)
    await db
      .insertInto('question_note')
      .values({
        id: newId(),
        owner_id: owner.ownerId,
        question_id: id,
        body: note.body,
        labels: note.labels,
        created_at: owner.now,
      })
      .execute();
}

/** A restored picture: its stored file, place and size; its crop box is not carried over. */
function pictureRow(
  owner: Owner,
  id: string,
  q: RestoredQuestion,
  p: RestoredQuestion['pictures'][number],
) {
  return {
    owner_id: owner.ownerId,
    source_id: q.sourceId,
    question_id: id,
    position: p.position,
    page: p.page,
    box: JSON.stringify({ x0: 0, y0: 0, x1: 0, y1: 0 }),
    kind: p.kind,
    modality: null,
    link: 'certain' as const,
    blob_key: p.blobKey,
    width: p.width,
    height: p.height,
    quality: JSON.stringify({ restored: true }),
    low_quality: false,
    created_at: owner.now,
  };
}

async function insertExtras(
  db: Db,
  owner: Owner,
  id: string,
  q: RestoredQuestion,
  newId: () => string,
) {
  await insertTagsAndNotes(db, owner, id, q, newId);
  for (const p of q.pictures)
    await db
      .insertInto('media')
      .values({ id: newId(), ...pictureRow(owner, id, q, p) })
      .execute();
}

/** Inserts restored questions as new ones of the bank, never over existing ones. */
async function restoreQuestions(
  db: Db,
  owner: { ownerId: string; bankId: string; now: Date },
  questions: readonly RestoredQuestion[],
  newId: () => string,
) {
  const ids: string[] = [];
  for (const q of questions) {
    const id = newId();
    await db
      .insertInto('question')
      .values({
        id,
        owner_id: owner.ownerId,
        bank_id: owner.bankId,
        source_id: q.sourceId,
        source_page: q.page,
        source_number: q.number,
        source_occurrence: q.occurrence,
        source_seq: q.seq,
        kind: q.kind,
        stem: q.stem,
        options: JSON.stringify(q.options),
        answer_letter: q.answers[0] ?? null,
        answer_letters: q.answers,
        answer_provenance: q.provenance,
        answer_evidence: q.evidence,
        explanation: q.explanation,
        update_note: q.updateNote,
        multi_select: q.multiSelect,
        chapter_id: q.chapterId,
        topic_id: q.topicId,
        classification: q.chapterId ? 'manual' : 'none',
        status: q.status,
        review_reasons: q.reasons,
        created_at: owner.now,
        updated_at: owner.now,
      })
      .execute();
    await insertExtras(db, owner, id, q, newId);
    ids.push(id);
  }
  return ids;
}

/** What deleting a bank takes with it (FR-19-005, UI-27): counted before the owner confirms. */
async function bankFootprint(db: Db, ownerId: string, bankId: string) {
  const row = await db
    .selectFrom('question as q')
    .select([
      sql<string>`count(*)`.as('questions'),
      sql<string>`(select count(*) from media m join question q2 on q2.id = m.question_id where q2.bank_id = ${bankId} and m.owner_id = ${ownerId})`.as(
        'pictures',
      ),
      sql<string>`(select count(*) from question_note n join question q3 on q3.id = n.question_id where q3.bank_id = ${bankId} and n.owner_id = ${ownerId})`.as(
        'notes',
      ),
    ])
    .where('q.owner_id', '=', ownerId)
    .where('q.bank_id', '=', bankId)
    .executeTakeFirstOrThrow();
  const ids = await db
    .selectFrom('question')
    .select('id')
    .where('owner_id', '=', ownerId)
    .where('bank_id', '=', bankId)
    .execute();
  const blobs = await db
    .selectFrom('media')
    .select('blob_key')
    .where('owner_id', '=', ownerId)
    .where('question_id', 'in', ids.length > 0 ? ids.map((r) => r.id) : [NO_ID])
    .execute();
  return {
    questions: Number(row.questions),
    pictures: Number(row.pictures),
    notes: Number(row.notes),
    questionIds: ids.map((r) => r.id),
    pictureBlobs: blobs.map((r) => r.blob_key),
  };
}

/** Export, restore and deletion support for the owner's questions (M13). */
export function createPortability(db: Db, newId: () => string) {
  return {
    questionsOfBank: (ownerId: string, bankId: string, chapterIds: readonly string[] | null) =>
      questionsOfBank(db, ownerId, bankId, chapterIds),
    extrasOf: (ownerId: string, ids: readonly string[]) => extrasOf(db, ownerId, ids),
    restoreQuestions: (
      owner: { ownerId: string; bankId: string; now: Date },
      questions: readonly RestoredQuestion[],
    ) => restoreQuestions(db, owner, questions, newId),
    bankFootprint: (ownerId: string, bankId: string) => bankFootprint(db, ownerId, bankId),
  };
}
