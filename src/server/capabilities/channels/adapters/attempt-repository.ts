import { sql } from 'kysely';
import type { Db } from '../../../platform/db/index.js';
import type { Snapshot } from '../../exam-rules/index.js';

/** A new attempt and the questions it asks, each as a fixed snapshot. */
export interface NewAttempt {
  id: string;
  channelId: string;
  ownerId: string;
  version: number;
  personName: string | null;
  personRef: string | null;
  personKey: string;
  tokenHash: string;
  startedAt: Date;
  deadlineAt: Date | null;
  items: { questionId: string; snapshot: Snapshot }[];
}

export type EndedBy = 'person' | 'time' | 'owner';

/** Reading attempts: by their token, by their share, by the person who takes them. */
function readQueries(db: Db) {
  const attempts = () => db.selectFrom('channel_attempt').selectAll();
  return {
    byTokenHash: (hash: string) => attempts().where('token_hash', '=', hash).executeTakeFirst(),
    byId: (id: string) => attempts().where('id', '=', id).executeTakeFirstOrThrow(),
    ofChannel: (channelId: string) =>
      attempts().where('channel_id', '=', channelId).orderBy('started_at').execute(),
    itemsOf: (attemptId: string) =>
      db
        .selectFrom('channel_attempt_item')
        .selectAll()
        .where('attempt_id', '=', attemptId)
        .orderBy('position')
        .execute(),
    itemsOfChannel: (channelId: string) =>
      db
        .selectFrom('channel_attempt_item')
        .select(['question_id', 'snapshot', 'chosen', 'correct'])
        .where('channel_id', '=', channelId)
        .orderBy('attempt_id')
        .orderBy('position')
        .execute(),
    countOfPerson: async (channelId: string, personKey: string) =>
      Number(
        (
          await db
            .selectFrom('channel_attempt')
            .select((eb) => eb.fn.countAll<string>().as('n'))
            .where('channel_id', '=', channelId)
            .where('person_key', '=', personKey)
            .executeTakeFirstOrThrow()
        ).n,
      ),
  };
}

async function insertAttempt(db: Db, attempt: NewAttempt) {
  await db
    .insertInto('channel_attempt')
    .values({
      id: attempt.id,
      channel_id: attempt.channelId,
      owner_id: attempt.ownerId,
      version: attempt.version,
      person_name: attempt.personName,
      person_ref: attempt.personRef,
      person_key: attempt.personKey,
      token_hash: attempt.tokenHash,
      status: 'active',
      ended_by: null,
      total: attempt.items.length,
      correct: null,
      started_at: attempt.startedAt,
      deadline_at: attempt.deadlineAt,
      submitted_at: null,
    })
    .execute();
  await db
    .insertInto('channel_attempt_item')
    .values(
      attempt.items.map((item, position) => ({
        attempt_id: attempt.id,
        position,
        channel_id: attempt.channelId,
        owner_id: attempt.ownerId,
        question_id: item.questionId,
        snapshot: JSON.stringify(item.snapshot),
      })),
    )
    .execute();
}

/** Ends an active attempt: unanswered items count as wrong. Undefined if it had already ended. */
async function finishAttempt(db: Db, attemptId: string, endedBy: EndedBy, now: Date) {
  await db
    .updateTable('channel_attempt_item')
    .set({ correct: false })
    .where('attempt_id', '=', attemptId)
    .where('correct', 'is', null)
    .execute();
  const right = db
    .selectFrom('channel_attempt_item')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('attempt_id', '=', attemptId)
    .where('correct', '=', true);
  return db
    .updateTable('channel_attempt')
    .set({ status: 'submitted', ended_by: endedBy, submitted_at: now, correct: right })
    .where('id', '=', attemptId)
    .where('status', '=', 'active')
    .returningAll()
    .executeTakeFirst();
}

/** Changes to one item of an attempt that is still under way. */
function itemWrites(db: Db) {
  const item = (attemptId: string, position: number) =>
    db
      .updateTable('channel_attempt_item')
      .where('attempt_id', '=', attemptId)
      .where('position', '=', position)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('channel_attempt')
            .select('id')
            .where('id', '=', attemptId)
            .where('status', '=', 'active'),
        ),
      );
  return {
    /** Opens the item (its first opening is kept) and makes it the attempt's place. */
    open: async (attemptId: string, position: number, now: Date) => {
      await item(attemptId, position)
        .set({ opened_at: sql`coalesce(opened_at, ${now})` })
        .execute();
      await db
        .updateTable('channel_attempt')
        .set({ position })
        .where('id', '=', attemptId)
        .execute();
    },
    /** False when the attempt has ended meanwhile. */
    choose: async (
      attemptId: string,
      position: number,
      answer: { chosen: string[]; correct: boolean; now: Date },
    ) =>
      (
        await item(attemptId, position)
          .set({ chosen: answer.chosen, correct: answer.correct, answered_at: answer.now })
          .executeTakeFirst()
      ).numUpdatedRows > 0n,
    flag: (attemptId: string, position: number, flagged: boolean) =>
      item(attemptId, position).set({ flagged }).execute(),
  };
}

/** Exam/practice attempts and their items (M30): the take transport's own tables. */
export function createAttemptRepository(db: Db) {
  const build = (handle: Db) => ({
    ...readQueries(handle),
    ...itemWrites(handle),
    insert: (attempt: NewAttempt) => insertAttempt(handle, attempt),
  });
  return {
    ...build(db),
    finish: (attemptId: string, endedBy: EndedBy, now: Date) =>
      db.transaction().execute((trx) => finishAttempt(trx, attemptId, endedBy, now)),
    /** Runs `work` with the share's row held, so one person's attempts are counted one at a time. */
    forPerson: <T>(channelId: string, work: (tx: ReturnType<typeof build>) => Promise<T>) =>
      db.transaction().execute(async (trx) => {
        await sql`select 1 from channel where id = ${channelId} for update`.execute(trx);
        return work(build(trx));
      }),
  };
}
export type AttemptRepository = ReturnType<typeof createAttemptRepository>;
export type AttemptRow = Awaited<ReturnType<AttemptRepository['byId']>>;
export type AttemptItemRow = Awaited<ReturnType<AttemptRepository['itemsOf']>>[number];
