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

/** The latest answer the owner gave to each of these questions, in any session. */
async function lastAttempts(db: Db, ownerId: string) {
  const rows = await db
    .selectFrom('study_item')
    .select(['question_id', 'correct', 'answered_at'])
    .distinctOn('question_id')
    .where('owner_id', '=', ownerId)
    .where('answered_at', 'is not', null)
    .where('question_id', 'is not', null)
    .orderBy('question_id')
    .orderBy('answered_at', 'desc')
    .execute();
  return rows.map((row) => ({
    questionId: row.question_id as string,
    correct: row.correct === true,
    answeredAt: row.answered_at as Date,
  }));
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
    lastAttempts: (ownerId: string) => lastAttempts(db, ownerId),
    activeSessions: (ownerId: string) => activeSessions(db, ownerId),
    answeredCounts: (sessionIds: readonly string[]) => answeredCounts(db, sessionIds),
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
