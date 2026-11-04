import { sql } from 'kysely';
import type { Db } from '../../../platform/db/index.js';
import type { StudyKind } from '../../../platform/db/schema.js';
import type { Snapshot } from '../domain/grading.js';

export interface NewSession {
  id: string;
  ownerId: string;
  mode: 'tutor' | 'exam';
  kind: StudyKind;
  scope: unknown;
  now: Date;
  items: { questionId: string | null; snapshot: Snapshot }[];
  /** An exam's announced timing (M10); a Tutor session has none. */
  timing?: {
    kind: 'none' | 'total' | 'per_question';
    seconds: number | null;
    deadline: Date | null;
  };
}

/** A session and its items, written together: never a session without its questions. */
async function createSession(db: Db, session: NewSession) {
  await db.transaction().execute(async (tx) => {
    await tx
      .insertInto('study_session')
      .values({
        id: session.id,
        owner_id: session.ownerId,
        mode: session.mode,
        kind: session.kind,
        scope: JSON.stringify(session.scope),
        size: session.items.length,
        status: 'active',
        created_at: session.now,
        updated_at: session.now,
        finished_at: null,
        timing: session.timing?.kind ?? 'none',
        timing_seconds: session.timing?.seconds ?? null,
        deadline_at: session.timing?.deadline ?? null,
      })
      .execute();
    await tx
      .insertInto('study_item')
      .values(
        session.items.map((item, position) => ({
          session_id: session.id,
          position,
          owner_id: session.ownerId,
          question_id: item.questionId,
          snapshot: JSON.stringify(item.snapshot),
          chosen: null,
          correct: null,
          seconds: null,
          answered_at: null,
        })),
      )
      .execute();
  });
}

const findSession = (db: Db, ownerId: string, id: string) =>
  db
    .selectFrom('study_session')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('id', '=', id)
    .executeTakeFirst();

export type SessionRow = NonNullable<Awaited<ReturnType<typeof findSession>>>;

const itemsOf = (db: Db, ownerId: string, sessionId: string) =>
  db
    .selectFrom('study_item')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('session_id', '=', sessionId)
    .orderBy('position')
    .execute();

export type ItemRow = Awaited<ReturnType<typeof itemsOf>>[number];

/**
 * Records the answer once (FR-12-006): only an unanswered item is updated, so coming back to it
 * never records a second, silent attempt (UAT-045). False when it was already answered.
 */
async function answerItem(
  db: Db,
  key: { ownerId: string; sessionId: string; position: number },
  answer: { chosen: string[]; correct: boolean; seconds: number; now: Date },
) {
  const result = await db
    .updateTable('study_item')
    .set({
      chosen: answer.chosen,
      correct: answer.correct,
      seconds: answer.seconds,
      answered_at: answer.now,
    })
    .where('owner_id', '=', key.ownerId)
    .where('session_id', '=', key.sessionId)
    .where('position', '=', key.position)
    .where('answered_at', 'is', null)
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
}

/** Every graded answer of the owner's, by question, oldest first (the mastery record, FR-15-001). */
async function attemptHistory(db: Db, ownerId: string) {
  const rows = await db
    .selectFrom('study_item')
    .select(['question_id', 'correct', 'answered_at'])
    .where('owner_id', '=', ownerId)
    .where('answered_at', 'is not', null)
    .where('correct', 'is not', null)
    .where('question_id', 'is not', null)
    .orderBy('answered_at')
    .orderBy('position')
    .execute();
  const history = new Map<string, { correct: boolean; at: Date }[]>();
  for (const row of rows) {
    const id = row.question_id as string;
    const attempt = { correct: row.correct === true, at: row.answered_at as Date };
    history.set(id, [...(history.get(id) ?? []), attempt]);
  }
  return history;
}

const activeSessions = (db: Db, ownerId: string) =>
  db
    .selectFrom('study_session')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('status', '=', 'active')
    .orderBy('updated_at', 'desc')
    .limit(10)
    .execute();

const answeredCounts = async (db: Db, sessionIds: readonly string[]) => {
  if (sessionIds.length === 0) return new Map<string, number>();
  const rows = await db
    .selectFrom('study_item')
    .select(['session_id', sql<string>`count(answered_at)`.as('answered')])
    .where('session_id', 'in', sessionIds)
    .groupBy('session_id')
    .execute();
  return new Map(rows.map((row) => [row.session_id, Number(row.answered)]));
};

type ItemKey = { ownerId: string; sessionId: string; position: number };

const itemWhere = (db: Db, key: ItemKey) =>
  db
    .updateTable('study_item')
    .where('owner_id', '=', key.ownerId)
    .where('session_id', '=', key.sessionId)
    .where('position', '=', key.position);

/** Saves an exam answer as chosen so far (FR-13-007); only before submission. */
const saveChoice = (db: Db, key: ItemKey, chosen: string[], now: Date) =>
  itemWhere(db, key).set({ chosen, saved_at: now }).where('answered_at', 'is', null).execute();

const setItemFlag = (db: Db, key: ItemKey, flagged: boolean) =>
  itemWhere(db, key).set({ flagged }).execute();

/** The first time a timed question is shown; later visits keep the first time. */
const openItem = (db: Db, key: ItemKey, now: Date) =>
  itemWhere(db, key).set({ opened_at: now }).where('opened_at', 'is', null).execute();

/**
 * Submits an exam (FR-13-011): every saved answer is graded at once against its snapshot, an
 * empty one stays unanswered, and the session records who ended it. All or nothing.
 */
async function submitExam(
  db: Db,
  ownerId: string,
  sessionId: string,
  graded: { position: number; correct: boolean }[],
  end: { by: 'owner' | 'time'; now: Date },
) {
  await db.transaction().execute(async (tx) => {
    for (const item of graded)
      await tx
        .updateTable('study_item')
        .set({ correct: item.correct, answered_at: end.now })
        .where('owner_id', '=', ownerId)
        .where('session_id', '=', sessionId)
        .where('position', '=', item.position)
        .execute();
    await tx
      .updateTable('study_session')
      .set({ status: 'finished', finished_at: end.now, updated_at: end.now, ended_by: end.by })
      .where('owner_id', '=', ownerId)
      .where('id', '=', sessionId)
      .where('status', '=', 'active')
      .execute();
  });
}

/** Past graded answers to one question, for the impact of changing its key (FR-24-004). */
const attemptsOf = (db: Db, ownerId: string, questionId: string) =>
  db
    .selectFrom('study_item')
    .select(['session_id', 'chosen', 'correct'])
    .where('owner_id', '=', ownerId)
    .where('question_id', '=', questionId)
    .where('answered_at', 'is not', null)
    .execute();

/** Owner-scoped store of study sessions and their answered items (M9). */
export function createSessionRepository(db: Db) {
  const update = (ownerId: string, id: string, changes: Record<string, unknown>) =>
    db
      .updateTable('study_session')
      .set(changes)
      .where('owner_id', '=', ownerId)
      .where('id', '=', id)
      .execute();
  return {
    createSession: (session: NewSession) => createSession(db, session),
    findSession: (ownerId: string, id: string) => findSession(db, ownerId, id),
    itemsOf: (ownerId: string, sessionId: string) => itemsOf(db, ownerId, sessionId),
    answerItem: (key: Parameters<typeof answerItem>[1], answer: Parameters<typeof answerItem>[2]) =>
      answerItem(db, key, answer),
    setPosition: (ownerId: string, id: string, position: number, now: Date) =>
      update(ownerId, id, { position, updated_at: now }),
    finish: (ownerId: string, id: string, now: Date) =>
      update(ownerId, id, { status: 'finished', finished_at: now, updated_at: now }),
    attemptHistory: (ownerId: string) => attemptHistory(db, ownerId),
    activeSessions: (ownerId: string) => activeSessions(db, ownerId),
    saveChoice: (key: ItemKey, chosen: string[], now: Date) => saveChoice(db, key, chosen, now),
    setItemFlag: (key: ItemKey, flagged: boolean) => setItemFlag(db, key, flagged),
    openItem: (key: ItemKey, now: Date) => openItem(db, key, now),
    submitExam: (
      ownerId: string,
      sessionId: string,
      graded: { position: number; correct: boolean }[],
      end: { by: 'owner' | 'time'; now: Date },
    ) => submitExam(db, ownerId, sessionId, graded, end),
    attemptsOf: (ownerId: string, questionId: string) => attemptsOf(db, ownerId, questionId),
    answeredCounts: (sessionIds: readonly string[]) => answeredCounts(db, sessionIds),
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
