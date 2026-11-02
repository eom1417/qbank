import type { Db } from '../../../platform/db/index.js';

export interface PasswordResetRepository {
  insert(tokenHash: string, accountId: string, expiresAt: Date): Promise<void>;
  /** Marks a valid (unused, unexpired) token as used and returns its account, atomically. */
  consume(tokenHash: string, now: Date): Promise<string | undefined>;
}

export function createPasswordResetRepository(db: Db): PasswordResetRepository {
  return {
    async insert(tokenHash, accountId, expiresAt) {
      await db
        .insertInto('password_reset')
        .values({ token_hash: tokenHash, account_id: accountId, expires_at: expiresAt })
        .execute();
    },
    async consume(tokenHash, now) {
      const row = await db
        .updateTable('password_reset')
        .set({ used_at: now })
        .where('token_hash', '=', tokenHash)
        .where('used_at', 'is', null)
        .where('expires_at', '>', now)
        .returning('account_id')
        .executeTakeFirst();
      return row?.account_id;
    },
  };
}
