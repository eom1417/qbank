// M8.6: a copy in another bank keeps its source page and number (FR-03-009), so only the
// original questions must be unique per place in their source.
// Immutable once applied: add a new migration instead of editing this one.
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table question drop constraint question_source_place_key`.execute(db);
  await sql`create unique index question_source_place_key
    on question (source_id, source_page, source_number, source_occurrence)
    where copied_from is null`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index question_source_place_key`.execute(db);
  await sql`alter table question add constraint question_source_place_key
    unique (source_id, source_page, source_number, source_occurrence)`.execute(db);
}
