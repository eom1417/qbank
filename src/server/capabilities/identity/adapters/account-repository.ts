import type { Db } from '../../../platform/db/index.js';
import type { Account } from '../domain/account.js';

interface NewAccount extends Account {
  passwordHash: string;
  termsAcceptedAt: Date;
}

export interface AccountRepository {
  insert(account: NewAccount): Promise<'created' | 'email_taken'>;
  findCredentials(email: string): Promise<{ id: string; passwordHash: string } | undefined>;
  findById(id: string): Promise<Account | undefined>;
}

const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;

export function createAccountRepository(db: Db): AccountRepository {
  return {
    async insert(account) {
      try {
        await db
          .insertInto('account')
          .values({
            id: account.id,
            email: account.email,
            password_hash: account.passwordHash,
            display_name: account.displayName,
            locale: account.locale,
            theme: account.theme,
            terms_accepted_at: account.termsAcceptedAt,
          })
          .execute();
        return 'created';
      } catch (error) {
        if (isUniqueViolation(error)) return 'email_taken';
        throw error;
      }
    },
    async findCredentials(email) {
      const row = await db
        .selectFrom('account')
        .select(['id', 'password_hash'])
        .where('email', '=', email)
        .executeTakeFirst();
      return row && { id: row.id, passwordHash: row.password_hash };
    },
    async findById(id) {
      const row = await db
        .selectFrom('account')
        .select(['id', 'email', 'display_name', 'locale', 'theme'])
        .where('id', '=', id)
        .executeTakeFirst();
      return row && { ...row, displayName: row.display_name };
    },
  };
}
