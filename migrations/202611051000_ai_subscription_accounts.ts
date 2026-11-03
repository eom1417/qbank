import { sql, type Kysely } from 'kysely';

// Immutable once applied: add a new migration instead of editing this one.
// Subscription accounts (owner direction 2026-11-03): a connection may be a Claude or ChatGPT
// (Codex) account signed in through the official CLI instead of an API key. Account
// connections have no base URL; their sealed credential is the CLI's login.
type Db = Kysely<unknown>;

export async function up(db: Db): Promise<void> {
  await sql`alter table ai_provider drop constraint ai_provider_kind_check`.execute(db);
  await sql`alter table ai_provider add constraint ai_provider_kind_check
    check (kind in ('openai_compatible', 'anthropic', 'claude_account', 'codex_account'))`.execute(db);
  await sql`alter table ai_provider alter column base_url drop not null`.execute(db);
  await sql`alter table ai_provider add constraint ai_provider_api_has_url
    check ((kind in ('openai_compatible', 'anthropic')) = (base_url is not null))`.execute(db);
  await sql`alter table ai_provider add column account_email text`.execute(db);
  await sql`alter table ai_provider add column account_plan text`.execute(db);
}

export async function down(db: Db): Promise<void> {
  await sql`delete from ai_provider where kind in ('claude_account', 'codex_account')`.execute(db);
  await sql`alter table ai_provider drop column account_plan`.execute(db);
  await sql`alter table ai_provider drop column account_email`.execute(db);
  await sql`alter table ai_provider drop constraint ai_provider_api_has_url`.execute(db);
  await sql`alter table ai_provider alter column base_url set not null`.execute(db);
  await sql`alter table ai_provider drop constraint ai_provider_kind_check`.execute(db);
  await sql`alter table ai_provider add constraint ai_provider_kind_check
    check (kind in ('openai_compatible', 'anthropic'))`.execute(db);
}
