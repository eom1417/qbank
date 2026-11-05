import { sql, type Insertable } from 'kysely';
import type { Db } from '../../../platform/db/index.js';
import type { Database } from '../../../platform/db/schema.js';

export type ChannelRow = NonNullable<
  Awaited<ReturnType<ReturnType<typeof channelQueries>['findOwned']>>
>;

/** A channel's own tables only (DEC-36): never study's, never the questions'. */
function channelQueries(db: Db) {
  return {
    insert: (row: Insertable<Database['channel']>) =>
      db.insertInto('channel').values(row).execute(),
    listOfBank: (ownerId: string, bankId: string) =>
      db
        .selectFrom('channel')
        .selectAll()
        .where('owner_id', '=', ownerId)
        .where('bank_id', '=', bankId)
        .orderBy('created_at')
        .execute(),
    findOwned: (ownerId: string, id: string) =>
      db
        .selectFrom('channel')
        .selectAll()
        .where('owner_id', '=', ownerId)
        .where('id', '=', id)
        .executeTakeFirst(),
    findByKeyHash: (hash: string) =>
      db.selectFrom('channel').selectAll().where('key_hash', '=', hash).executeTakeFirst(),
    update: (ownerId: string, id: string, patch: Record<string, unknown>) =>
      db
        .updateTable('channel')
        .set(patch)
        .where('owner_id', '=', ownerId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst(),
    remove: async (ownerId: string, id: string) =>
      (
        await db
          .deleteFrom('channel')
          .where('owner_id', '=', ownerId)
          .where('id', '=', id)
          .executeTakeFirst()
      ).numDeletedRows > 0n,
    touch: (id: string, now: Date) =>
      db.updateTable('channel').set({ last_used_at: now }).where('id', '=', id).execute(),
  };
}

/** What a channel sent: its batches and the questions in them. */
function deliveryQueries(db: Db) {
  return {
    sentInCycle: async (channelId: string, cycle: number) =>
      (
        await db
          .selectFrom('channel_delivery')
          .select('question_id')
          .where('channel_id', '=', channelId)
          .where('cycle', '=', cycle)
          .execute()
      ).map((row) => row.question_id),
    batchByKey: (channelId: string, key: string) =>
      db
        .selectFrom('channel_batch')
        .selectAll()
        .where('channel_id', '=', channelId)
        .where('batch_key', '=', key)
        .executeTakeFirst(),
    batchById: (channelId: string, id: string) =>
      db
        .selectFrom('channel_batch')
        .selectAll()
        .where('channel_id', '=', channelId)
        .where('id', '=', id)
        .executeTakeFirst(),
    deliveriesOf: (batchId: string) =>
      db
        .selectFrom('channel_delivery')
        .selectAll()
        .where('batch_id', '=', batchId)
        .orderBy('position')
        .execute(),
    delivery: (channelId: string, id: string) =>
      db
        .selectFrom('channel_delivery')
        .selectAll()
        .where('channel_id', '=', channelId)
        .where('id', '=', id)
        .executeTakeFirst(),
    hasSent: async (channelId: string, questionId: string) =>
      (await db
        .selectFrom('channel_delivery')
        .select('id')
        .where('channel_id', '=', channelId)
        .where('question_id', '=', questionId)
        .executeTakeFirst()) !== undefined,
  };
}

interface NewBatch {
  id: string;
  channelId: string;
  ownerId: string;
  key: string | null;
  cycle: number;
  now: Date;
  deliveries: { id: string; questionId: string }[];
}

/** Saves a batch and its deliveries, and moves the channel to the batch's cycle. */
async function saveBatch(db: Db, batch: NewBatch) {
  await db
    .insertInto('channel_batch')
    .values({
      id: batch.id,
      channel_id: batch.channelId,
      owner_id: batch.ownerId,
      batch_key: batch.key,
      cycle: batch.cycle,
      created_at: batch.now,
    })
    .execute();
  if (batch.deliveries.length > 0)
    await db
      .insertInto('channel_delivery')
      .values(
        batch.deliveries.map((delivery, position) => ({
          id: delivery.id,
          batch_id: batch.id,
          channel_id: batch.channelId,
          owner_id: batch.ownerId,
          question_id: delivery.questionId,
          cycle: batch.cycle,
          position,
          sent_at: batch.now,
        })),
      )
      .execute();
  await db
    .updateTable('channel')
    .set({ cycle: batch.cycle, last_used_at: batch.now })
    .where('id', '=', batch.channelId)
    .execute();
}

/** Records one recipient's answer once; false when that recipient already answered. */
async function saveAnswer(
  db: Db,
  answer: {
    deliveryId: string;
    channelId: string;
    ownerId: string;
    recipientHash: string;
    choice: string[];
    correct: boolean;
    now: Date;
  },
) {
  const saved = await db
    .insertInto('channel_answer')
    .values({
      delivery_id: answer.deliveryId,
      channel_id: answer.channelId,
      owner_id: answer.ownerId,
      recipient_hash: answer.recipientHash,
      choice: answer.choice,
      correct: answer.correct,
      answered_at: answer.now,
    })
    .onConflict((conflict) => conflict.doNothing())
    .returning('delivery_id')
    .executeTakeFirst();
  return saved !== undefined;
}

/** A channel's own repository; `locked` runs work with the channel row held (one batch at a time). */
export function createChannelRepository(db: Db) {
  const build = (handle: Db) => ({
    ...channelQueries(handle),
    ...deliveryQueries(handle),
    saveBatch: (batch: NewBatch) => saveBatch(handle, batch),
    saveAnswer: (answer: Parameters<typeof saveAnswer>[1]) => saveAnswer(handle, answer),
  });
  return {
    ...build(db),
    locked: <T>(channelId: string, work: (tx: ReturnType<typeof build>) => Promise<T>) =>
      db.transaction().execute(async (trx) => {
        await sql`select id from channel where id = ${channelId} for update`.execute(trx);
        return work(build(trx));
      }),
  };
}

export type ChannelRepository = ReturnType<typeof createChannelRepository>;
