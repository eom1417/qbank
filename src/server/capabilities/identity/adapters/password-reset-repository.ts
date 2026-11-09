import type { Db } from '../../../platform/db/index.js';

/** An account's newest reset request that nobody has used yet. */
export interface OpenReset {
  accountId: string;
  email: string;
  displayName: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface PasswordResetRepository {
  insert(tokenHash: string, accountId: string, expiresAt: Date): Promise<void>;
  /** Marks a valid (unused, unexpired) token as used and returns its account, atomically. */
  consume(tokenHash: string, now: Date): Promise<string | undefined>;
  /** Every account whose newest request is unused, newest request first (DEC-40). */
  listOpen(): Promise<OpenReset[]>;
  /** One account's newest request, when it is unused. */
  findOpen(accountId: string): Promise<OpenReset | undefined>;
}

/** Each account's newest request with its account's name; used ones are filtered out after. */
function latestRequests(db: Db) {
  const latest = db
    .selectFrom('password_reset')
    .distinctOn('account_id')
    .select(['account_id', 'token_hash', 'created_at', 'expires_at', 'used_at'])
    .orderBy('account_id')
    .orderBy('created_at', 'desc')
    .as('latest');
  return db
    .selectFrom(latest)
    .innerJoin('account', 'account.id', 'latest.account_id')
    .select([
      'latest.account_id as accountId',
      'account.email as email',
      'account.display_name as displayName',
      'latest.token_hash as tokenHash',
      'latest.created_at as createdAt',
      'latest.expires_at as expiresAt',
    ])
    .where('latest.used_at', 'is', null);
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
    listOpen: () => latestRequests(db).orderBy('latest.created_at', 'desc').limit(500).execute(),
    findOpen: (accountId) =>
      latestRequests(db).where('latest.account_id', '=', accountId).executeTakeFirst(),
  };
}
