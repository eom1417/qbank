import { sql, type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
// Owner direction 2026-11-03: AI is the user's own provider (BYOK). The operator-run `local`
// kind is removed; every connection names its API (`openai_compatible` or `anthropic`) and URL.
type Db = Kysely<unknown>;

export async function up(db: Db): Promise<void> {
  // Only development data used the `local` kind (it never shipped); those rows held no key.
  await sql`delete from ai_provider where kind = 'local'`.execute(db);
  await sql`alter table ai_provider drop constraint ai_provider_local_has_no_url`.execute(db);
  await sql`alter table ai_provider drop constraint ai_provider_kind_check`.execute(db);
  await sql`alter table ai_provider add constraint ai_provider_kind_check
    check (kind in ('openai_compatible', 'anthropic'))`.execute(db);
  await sql`alter table ai_provider alter column base_url set not null`.execute(db);
}

export async function down(db: Db): Promise<void> {
  await sql`alter table ai_provider alter column base_url drop not null`.execute(db);
  await sql`alter table ai_provider drop constraint ai_provider_kind_check`.execute(db);
  await sql`delete from ai_provider where kind = 'anthropic'`.execute(db);
  await sql`alter table ai_provider add constraint ai_provider_kind_check
    check (kind in ('local', 'openai_compatible'))`.execute(db);
  await sql`alter table ai_provider add constraint ai_provider_local_has_no_url
    check ((kind = 'local') = (base_url is null))`.execute(db);
}
