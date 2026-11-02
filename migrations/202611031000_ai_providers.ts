import { sql, type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
type Db = Kysely<unknown>;

const READINESS = [
  'unchecked',
  'ready',
  'invalid_key',
  'no_permission',
  'no_quota',
  'rate_limited',
  'unreachable',
  'model_missing',
  'unexpected',
];

async function providers(db: Db) {
  await db.schema
    .createTable('ai_provider')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('owner_id', 'uuid', (c) => c.notNull().references('account.id').onDelete('cascade'))
    .addColumn('kind', 'text', (c) =>
      c.notNull().check(sql`kind in ('local', 'openai_compatible')`),
    )
    .addColumn('label', 'text', (c) => c.notNull())
    .addColumn('base_url', 'text')
    .addColumn('model', 'text', (c) => c.notNull())
    // AES-256-GCM under QBANK_MASTER_KEY, bound to (owner_id, id); never stored in clear.
    .addColumn('key_ciphertext', 'text')
    .addColumn('key_hint', 'text')
    .addColumn('input_price', 'double precision')
    .addColumn('output_price', 'double precision')
    .addColumn('is_default', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('readiness_status', 'text', (c) =>
      c
        .notNull()
        .defaultTo('unchecked')
        .check(sql`readiness_status in (${sql.join(READINESS.map((s) => sql.lit(s)))})`),
    )
    .addColumn('readiness_checked_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull())
    .addCheckConstraint('ai_provider_local_has_no_url', sql`(kind = 'local') = (base_url is null)`)
    .execute();
  // At most one default provider per account.
  await sql`create unique index ai_provider_one_default on ai_provider (owner_id) where is_default`.execute(
    db,
  );
}

async function settings(db: Db) {
  await db.schema
    .createTable('ai_settings')
    .addColumn('owner_id', 'uuid', (c) =>
      c.primaryKey().references('account.id').onDelete('cascade'),
    )
    .addColumn('cost_limit_usd', 'double precision', (c) => c.check(sql`cost_limit_usd >= 0`))
    .addColumn('approval_pages', 'integer', (c) =>
      c.notNull().check(sql`approval_pages between 1 and 5000`),
    )
    .execute();
}

export async function up(db: Db): Promise<void> {
  await providers(db);
  await settings(db);
}

export async function down(db: Db): Promise<void> {
  await db.schema.dropTable('ai_settings').execute();
  await db.schema.dropTable('ai_provider').execute();
}
