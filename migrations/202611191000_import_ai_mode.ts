// How the user's AI helps an import: 'verify' (it checks answers the rules left open) or 'read'
// (it reads whole pages: questions, options, printed key and explanation, and pictures).
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

const TABLE = 'import_job';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable(TABLE)
    .addColumn('ai_mode', 'text', (column) =>
      column
        .notNull()
        .defaultTo('verify')
        .check(sql`ai_mode in ('verify', 'read')`),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable(TABLE).dropColumn('ai_mode').execute();
}
