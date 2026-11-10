import { sql, type Selectable, type Updateable } from 'kysely';
import { isUniqueViolation } from '../../../platform/db/errors.js';
import type { Db } from '../../../platform/db/index.js';
import type { Database } from '../../../platform/db/schema.js';
import { skinOf, type UpdateAccountRequest } from '../../../../contracts/identity.js';
import type { Account } from '../domain/account.js';

interface NewAccount extends Account {
  /** Null for an account made by Google sign-in (M32): no password ever signs it in. */
  passwordHash: string | null;
  googleSub?: string;
  termsAcceptedAt: Date;
}

export interface AccountContact {
  email: string;
  displayName: string;
}

export interface AccountRepository {
  insert(account: NewAccount): Promise<'created' | 'email_taken'>;
  findCredentials(email: string): Promise<{ id: string; passwordHash: string | null } | undefined>;
  findPasswordHash(id: string): Promise<string | null | undefined>;
  findById(id: string): Promise<Account | undefined>;
  /** The account linked to this Google subject (M32, DEC-42). */
  findByGoogleSub(sub: string): Promise<Account | undefined>;
  /** The account with this e-mail, whatever its case. */
  findByEmail(email: string): Promise<Account | undefined>;
  /** Links an account to a Google subject; false when it is already linked (or the sub is taken). */
  linkGoogle(id: string, sub: string): Promise<boolean>;
  update(id: string, changes: UpdateAccountRequest): Promise<void>;
  setPasswordHash(id: string, passwordHash: string): Promise<void>;
  /** E-mail and name of each account found, by id (the operator's console, DEC-40). */
  contactsOf(ids: readonly string[]): Promise<Map<string, AccountContact>>;
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
    skin: skinOf(row.skin),
    defaultSessionSize: row.default_session_size,
    explanationMode: row.explanation_mode,
    reviewReminders: row.review_reminders,
  },
  operatorConfirmed: row.operator_confirmed_at !== null,
  googleLinked: row.google_sub !== null,
});

/** Column names for a partial update; undefined fields are left untouched. */
const toChanges = (changes: UpdateAccountRequest): Updateable<Database['account']> => ({
  display_name: changes.displayName,
  locale: changes.locale,
  theme: changes.theme,
  skin: changes.skin,
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
      google_sub: account.googleSub ?? null,
      display_name: account.displayName,
      locale: p.locale,
      theme: p.theme,
      skin: p.skin,
      default_session_size: p.defaultSessionSize,
      explanation_mode: p.explanationMode,
      review_reminders: p.reviewReminders,
      terms_accepted_at: account.termsAcceptedAt,
    })
    .execute();
}

/** The one account with this id, Google subject or e-mail (in any case). */
async function findAccount(db: Db, key: 'id' | 'google_sub' | 'email', value: string) {
  const query = db.selectFrom('account').selectAll();
  const row = await (
    key === 'email'
      ? query.where(sql<string>`lower(email)`, '=', value.toLowerCase())
      : query.where(key, '=', value)
  ).executeTakeFirst();
  return row && fromRow(row);
}

async function linkGoogle(db: Db, id: string, sub: string): Promise<boolean> {
  try {
    const result = await db
      .updateTable('account')
      .set({ google_sub: sub })
      .where('id', '=', id)
      .where('google_sub', 'is', null)
      .executeTakeFirst();
    return result.numUpdatedRows > 0n;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

async function findContacts(db: Db, ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, AccountContact>();
  const rows = await db
    .selectFrom('account')
    .select(['id', 'email', 'display_name'])
    .where('id', 'in', [...ids])
    .execute();
  return new Map(rows.map((r) => [r.id, { email: r.email, displayName: r.display_name }]));
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
    findById: (id) => findAccount(db, 'id', id),
    findByGoogleSub: (sub) => findAccount(db, 'google_sub', sub),
    findByEmail: (email) => findAccount(db, 'email', email),
    linkGoogle: (id, sub) => linkGoogle(db, id, sub),
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
    contactsOf: (ids) => findContacts(db, ids),
    async delete(id) {
      const result = await db.deleteFrom('account').where('id', '=', id).executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
  };
}
