import { sql, type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
type Db = Kysely<unknown>;

async function accountPreferences(db: Db) {
  await db.schema
    .alterTable('account')
    .addColumn('default_session_size', 'integer', (c) =>
      c
        .notNull()
        .defaultTo(20)
        .check(sql`default_session_size between 1 and 200`),
    )
    .addColumn('explanation_mode', 'text', (c) =>
      c
        .notNull()
        .defaultTo('after_answer')
        .check(sql`explanation_mode in ('after_answer', 'on_request')`),
    )
    .execute();
}

async function passwordResetAndOutbox(db: Db) {
  await db.schema
    .createTable('password_reset')
    .addColumn('account_id', 'uuid', (c) =>
      c.notNull().references('account.id').onDelete('cascade'),
    )
    .addColumn('token_hash', 'text', (c) => c.primaryKey())
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('used_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  // Local mail adapter (DEC-28): messages are stored, never sent, until M16.3.
  await db.schema
    .createTable('mail_outbox')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('to_address', 'text', (c) => c.notNull())
    .addColumn('subject', 'text', (c) => c.notNull())
    .addColumn('body_text', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
}

async function chaptersAndTopics(db: Db) {
  await db.schema
    .createTable('chapter')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull())
    .addColumn('bank_id', 'uuid', (c) => c.notNull())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('position', 'integer', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addForeignKeyConstraint(
      'chapter_bank_fk',
      ['owner_id', 'bank_id'],
      'bank',
      ['owner_id', 'id'],
      (fk) => fk.onDelete('cascade'),
    )
    .addUniqueConstraint('chapter_owner_id_id_key', ['owner_id', 'id'])
    .execute();
  await db.schema
    .createTable('topic')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull())
    .addColumn('chapter_id', 'uuid', (c) => c.notNull())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addForeignKeyConstraint(
      'topic_chapter_fk',
      ['owner_id', 'chapter_id'],
      'chapter',
      ['owner_id', 'id'],
      (fk) => fk.onDelete('cascade'),
    )
    .execute();
}

async function tags(db: Db) {
  await db.schema
    .createTable('tag')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull().references('account.id').onDelete('cascade'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await sql`create unique index tag_owner_name_key on tag (owner_id, lower(name))`.execute(db);
}

export async function up(db: Db): Promise<void> {
  await accountPreferences(db);
  await passwordResetAndOutbox(db);
  await chaptersAndTopics(db);
  await tags(db);
}

export async function down(db: Db): Promise<void> {
  for (const table of ['tag', 'topic', 'chapter', 'mail_outbox', 'password_reset']) {
    await db.schema.dropTable(table).execute();
  }
  await db.schema
    .alterTable('account')
    .dropColumn('default_session_size')
    .dropColumn('explanation_mode')
    .execute();
}
