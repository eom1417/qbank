// The chosen look-and-feel skin (one engine, several experiences). Immutable once applied.
// No check constraint on purpose: the contract validates the name, so adding a skin needs no
// migration, and a skin no longer offered falls back to the default when read.
import type { Kysely } from 'kysely';

const COLUMN = 'skin';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('account')
    .addColumn(COLUMN, 'text', (column) => column.notNull().defaultTo('clinic'))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('account').dropColumn(COLUMN).execute();
}
