import { sql, type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('account')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('email', 'text', (c) => c.notNull().unique())
    .addColumn('password_hash', 'text', (c) => c.notNull())
    .addColumn('display_name', 'text', (c) => c.notNull())
    .addColumn('locale', 'text', (c) => c.notNull().check(sql`locale in ('ar', 'en')`))
    .addColumn('theme', 'text', (c) =>
      c
        .notNull()
        .defaultTo('system')
        .check(sql`theme in ('system', 'light', 'dark')`),
    )
    .addColumn('terms_accepted_at', 'timestamptz', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('auth_session')
    .addColumn('token_hash', 'text', (c) => c.primaryKey())
    .addColumn('account_id', 'uuid', (c) =>
      c.notNull().references('account.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('auth_session_account_idx')
    .on('auth_session')
    .column('account_id')
    .execute();

  await db.schema
    .createTable('bank')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull().references('account.id').onDelete('cascade'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('description', 'text')
    .addColumn('subject', 'text')
    .addColumn('archived_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull())
    // Child rows reference (owner_id, id) so they can never point at another account's bank.
    .addUniqueConstraint('bank_owner_id_id_key', ['owner_id', 'id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('bank').execute();
  await db.schema.dropTable('auth_session').execute();
  await db.schema.dropTable('account').execute();
}
