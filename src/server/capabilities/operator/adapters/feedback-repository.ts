import type { Db } from '../../../platform/db/index.js';

interface Feedback {
  id: string;
  ownerId: string;
  message: string;
  screen: string;
  version: string;
  createdAt: Date;
  closedAt: Date | null;
}

export interface FeedbackRepository {
  insert(note: Omit<Feedback, 'closedAt'>): Promise<void>;
  /** Notes the account sent since `since` (the rate limit counts in the database). */
  countSince(ownerId: string, since: Date): Promise<number>;
  /** The newest notes first. */
  list(limit: number): Promise<Feedback[]>;
  /** Closes a note (a closed one keeps its first closing time); false when there is none. */
  close(id: string, now: Date): Promise<boolean>;
}

export function createFeedbackRepository(db: Db): FeedbackRepository {
  return {
    async insert(note) {
      await db
        .insertInto('feedback')
        .values({
          id: note.id,
          owner_id: note.ownerId,
          message: note.message,
          screen: note.screen,
          version: note.version,
          created_at: note.createdAt,
        })
        .execute();
    },
    async countSince(ownerId, since) {
      const row = await db
        .selectFrom('feedback')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('owner_id', '=', ownerId)
        .where('created_at', '>', since)
        .executeTakeFirstOrThrow();
      return Number(row.count);
    },
    list: (limit) =>
      db
        .selectFrom('feedback')
        .select([
          'id',
          'owner_id as ownerId',
          'message',
          'screen',
          'version',
          'created_at as createdAt',
          'closed_at as closedAt',
        ])
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute(),
    async close(id, now) {
      const result = await db
        .updateTable('feedback')
        .set((eb) => ({ closed_at: eb.fn.coalesce('closed_at', eb.val(now)) }))
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numUpdatedRows > 0n;
    },
  };
}
