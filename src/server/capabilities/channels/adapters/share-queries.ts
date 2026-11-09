import { sql } from 'kysely';
import type { Db } from '../../../platform/db/index.js';
import { NO_ID } from '../../../platform/ids.js';

const count = (value: unknown) => Number(value ?? 0);

/** The account's rows of one share table, counted per share. */
const countedPerShare = (
  db: Db,
  table: 'channel_batch' | 'channel_attempt',
  ownerId: string,
  ids: string[],
) =>
  db
    .selectFrom(table)
    .select(['channel_id', sql<string>`count(*)`.as('n')])
    .where('owner_id', '=', ownerId)
    .where('channel_id', 'in', ids)
    .groupBy('channel_id')
    .execute();

/** How many times each share was used: batches (agent) and attempts started (exam/practice). */
async function usesOf(db: Db, ownerId: string, channelIds: readonly string[]) {
  const ids = channelIds.length > 0 ? [...channelIds] : [NO_ID];
  const [batches, attempts] = await Promise.all([
    countedPerShare(db, 'channel_batch', ownerId, ids),
    countedPerShare(db, 'channel_attempt', ownerId, ids),
  ]);
  const uses = new Map<string, number>();
  for (const row of [...batches, ...attempts])
    uses.set(row.channel_id, (uses.get(row.channel_id) ?? 0) + count(row.n));
  return uses;
}

/** Deletes a share's records older than its retention; the counts of what went. */
async function purgeOlder(db: Db, channelId: string, cutoff: Date) {
  const answers = await db
    .deleteFrom('channel_answer')
    .where('channel_id', '=', channelId)
    .where('answered_at', '<', cutoff)
    .executeTakeFirst();
  const attempts = await db
    .deleteFrom('channel_attempt')
    .where('channel_id', '=', channelId)
    .where(sql<Date>`coalesce(submitted_at, started_at)`, '<', cutoff)
    .executeTakeFirst();
  return { answers: Number(answers.numDeletedRows), attempts: Number(attempts.numDeletedRows) };
}

/**
 * What the owner's sharing views and the retention purge read across shares (DEC-39): the
 * shares themselves, their use counts, and their old records. A share's own tables only.
 */
export function createShareQueries(db: Db) {
  /** The account's shares, of one bank or (no bank) all of them. */
  const sharesOf = (ownerId: string, bankId?: string) => {
    const query = db.selectFrom('channel').selectAll().where('owner_id', '=', ownerId);
    return bankId === undefined ? query : query.where('bank_id', '=', bankId);
  };
  return {
    /** The account's shares, of one bank or (no bank) all of them, oldest first. */
    listOfAccount: (ownerId: string, bankId?: string) =>
      sharesOf(ownerId, bankId).orderBy('created_at').execute(),
    /** The bank's exam shares that are not archived (those that may reserve their scope). */
    examsOfBank: (ownerId: string, bankId: string) =>
      sharesOf(ownerId, bankId)
        .where('kind', '=', 'exam')
        .where('archived_at', 'is', null)
        .execute(),
    /** New batches the agent share took since a moment (its daily limit). */
    batchesSince: async (channelId: string, since: Date) =>
      count(
        (
          await db
            .selectFrom('channel_batch')
            .select(sql<string>`count(*)`.as('n'))
            .where('channel_id', '=', channelId)
            .where('created_at', '>=', since)
            .executeTakeFirstOrThrow()
        ).n,
      ),
    usesOf: (ownerId: string, channelIds: readonly string[]) => usesOf(db, ownerId, channelIds),
    /** Every share of every account, for the daily retention purge. */
    everyShare: () => db.selectFrom('channel').selectAll().execute(),
    purgeOlder: (channelId: string, cutoff: Date) => purgeOlder(db, channelId, cutoff),
  };
}
export type ShareQueries = ReturnType<typeof createShareQueries>;
