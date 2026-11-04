// M14.4: optional review reminders, off unless the owner turns them on (FR-22-004, DEC-22).
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table account add column review_reminders text not null default 'off'
    check (review_reminders in ('off', 'daily', 'weekly'))`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('account').dropColumn('review_reminders').execute();
}
