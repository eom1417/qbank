// M32 (DEC-42): a server with a Google client signs people in with Google only. An account then
// carries its Google subject (the stable id Google gives each person) and may have no password.
// Existing accounts keep their password hash until they first sign in with Google, which links
// them by their verified e-mail.
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table account alter column password_hash drop not null`.execute(db);
  await sql`alter table account add column google_sub text unique`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table account drop column if exists google_sub`.execute(db);
  await sql`update account set password_hash = '' where password_hash is null`.execute(db);
  await sql`alter table account alter column password_hash set not null`.execute(db);
}
