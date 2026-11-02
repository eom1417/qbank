import type { Db } from '../../../platform/db/index.js';

export interface SessionRepository {
  insert(tokenHash: string, accountId: string, expiresAt: Date): Promise<void>;
  findAccountId(tokenHash: string, now: Date): Promise<string | undefined>;
  delete(tokenHash: string): Promise<void>;
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
  };
}
