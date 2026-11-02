import type { Db } from '../../../platform/db/index.js';

export interface SessionRepository {
  insert(tokenHash: string, accountId: string, expiresAt: Date): Promise<void>;
  findAccountId(tokenHash: string, now: Date): Promise<string | undefined>;
  delete(tokenHash: string): Promise<void>;
  /** Revokes every session of an account except the one being kept (if any). */
  deleteOthers(accountId: string, keepTokenHash: string | null): Promise<void>;
}

export function createSessionRepository(db: Db): SessionRepository {
  return {
    async insert(tokenHash, accountId, expiresAt) {
      await db
        .insertInto('auth_session')
        .values({ token_hash: tokenHash, account_id: accountId, expires_at: expiresAt })
        .execute();
    },
    async findAccountId(tokenHash, now) {
      const row = await db
        .selectFrom('auth_session')
        .select('account_id')
        .where('token_hash', '=', tokenHash)
        .where('expires_at', '>', now)
        .executeTakeFirst();
      return row?.account_id;
    },
    async delete(tokenHash) {
      await db.deleteFrom('auth_session').where('token_hash', '=', tokenHash).execute();
    },
    async deleteOthers(accountId, keepTokenHash) {
      let query = db.deleteFrom('auth_session').where('account_id', '=', accountId);
      if (keepTokenHash) query = query.where('token_hash', '!=', keepTokenHash);
      await query.execute();
    },
  };
}
