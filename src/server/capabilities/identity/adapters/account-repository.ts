import type { Selectable, Updateable } from 'kysely';
import { isUniqueViolation } from '../../../platform/db/errors.js';
import type { Db } from '../../../platform/db/index.js';
import type { Database } from '../../../platform/db/schema.js';
import type { UpdateAccountRequest } from '../../../../contracts/identity.js';
import type { Account } from '../domain/account.js';

interface NewAccount extends Account {
  passwordHash: string;
  termsAcceptedAt: Date;
}

export interface AccountRepository {
  insert(account: NewAccount): Promise<'created' | 'email_taken'>;
  findCredentials(email: string): Promise<{ id: string; passwordHash: string } | undefined>;
  findPasswordHash(id: string): Promise<string | undefined>;
  findById(id: string): Promise<Account | undefined>;
  update(id: string, changes: UpdateAccountRequest): Promise<void>;
  setPasswordHash(id: string, passwordHash: string): Promise<void>;
  /** Deletes the account; everything it owns goes with it (database cascades). */
  delete(id: string): Promise<boolean>;
}

type AccountRow = Selectable<Database['account']>;

const fromRow = (row: AccountRow): Account => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  preferences: {
    locale: row.locale,
    theme: row.theme,
    defaultSessionSize: row.default_session_size,
    explanationMode: row.explanation_mode,
    reviewReminders: row.review_reminders,
  },
});

/** Column names for a partial update; undefined fields are left untouched. */
const toChanges = (changes: UpdateAccountRequest): Updateable<Database['account']> => ({
  display_name: changes.displayName,
  locale: changes.locale,
  theme: changes.theme,
  default_session_size: changes.defaultSessionSize,
  explanation_mode: changes.explanationMode,
  review_reminders: changes.reviewReminders,
});

async function insertAccount(db: Db, account: NewAccount) {
  const { preferences: p } = account;
  await db
    .insertInto('account')
    .values({
      id: account.id,
      email: account.email,
      password_hash: account.passwordHash,
      display_name: account.displayName,
      locale: p.locale,
      theme: p.theme,
      default_session_size: p.defaultSessionSize,
      explanation_mode: p.explanationMode,
      review_reminders: p.reviewReminders,
      terms_accepted_at: account.termsAcceptedAt,
    })
    .execute();
}

export function createAccountRepository(db: Db): AccountRepository {
  const byId = (id: string) => db.selectFrom('account').where('id', '=', id);
  return {
    async insert(account) {
      try {
        await insertAccount(db, account);
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
    async findPasswordHash(id) {
      return (await byId(id).select('password_hash').executeTakeFirst())?.password_hash;
    },
    async findById(id) {
      const row = await byId(id).selectAll().executeTakeFirst();
      return row && fromRow(row);
    },
    async update(id, changes) {
      await db.updateTable('account').set(toChanges(changes)).where('id', '=', id).execute();
    },
    async setPasswordHash(id, passwordHash) {
      await db
        .updateTable('account')
        .set({ password_hash: passwordHash })
        .where('id', '=', id)
        .execute();
    },
    async delete(id) {
      const result = await db.deleteFrom('account').where('id', '=', id).executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
  };
}
