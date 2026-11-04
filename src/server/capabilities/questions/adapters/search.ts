import { sql, type ExpressionBuilder } from 'kysely';
import type { Db } from '../../../platform/db/index.js';
import type { Database } from '../../../platform/db/schema.js';

/** What a search may narrow by (FR-17-001, FR-17-006); every filter stays in the account. */
export interface SearchFilter {
  text?: string | undefined;
  bankId?: string | undefined;
  chapterId?: string | undefined;
  sourceId?: string | undefined;
  tagId?: string | undefined;
  status?: 'detected' | 'needs_review' | 'eligible' | 'excluded' | undefined;
  flagged?: boolean | undefined;
  favorite?: boolean | undefined;
  deferred?: boolean | undefined;
  noAnswer?: boolean | undefined;
}

const LIMIT = 300;

/** `%` and `_` in the owner's words are searched for as themselves. */
const like = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

type Eb = ExpressionBuilder<Database & { q: Database['question'] }, 'q'>;

/**
 * The words anywhere the owner may look (FR-03-005, FR-17-001): the stem, the options, their
 * own notes, tags, the source's file name and the bank's name. Any script, any case.
 */
function textMatch(eb: Eb, text: string) {
  const pattern = like(text);
  return eb.or([
    eb('q.stem', 'ilike', pattern),
    eb(sql`q.options::text`, 'ilike', pattern),
    eb.exists(
      eb
        .selectFrom('question_note as n')
        .select('n.id')
        .whereRef('n.question_id', '=', 'q.id')
        .where('n.body', 'ilike', pattern),
    ),
    eb.exists(
      eb
        .selectFrom('question_tag as qt')
        .innerJoin('tag as t', 't.id', 'qt.tag_id')
        .select('qt.tag_id')
        .whereRef('qt.question_id', '=', 'q.id')
        .where('t.name', 'ilike', pattern),
    ),
    eb.exists(
      eb
        .selectFrom('source as s')
        .select('s.id')
        .whereRef('s.id', '=', 'q.source_id')
        .where('s.file_name', 'ilike', pattern),
    ),
    eb.exists(
      eb
        .selectFrom('bank as b')
        .select('b.id')
        .whereRef('b.id', '=', 'q.bank_id')
        .where('b.name', 'ilike', pattern),
    ),
  ]);
}

function markFilters(eb: Eb, filter: SearchFilter) {
  const mark = (column: 'flagged' | 'favorite') =>
    eb.exists(
      eb
        .selectFrom('question_mark as m')
        .select('m.question_id')
        .whereRef('m.question_id', '=', 'q.id')
        .where(`m.${column}`, '=', true),
    );
  const parts = [];
  if (filter.flagged) parts.push(mark('flagged'));
  if (filter.favorite) parts.push(mark('favorite'));
  if (filter.tagId)
    parts.push(
      eb.exists(
        eb
          .selectFrom('question_tag as qt')
          .select('qt.tag_id')
          .whereRef('qt.question_id', '=', 'q.id')
          .where('qt.tag_id', '=', filter.tagId),
      ),
    );
  return parts;
}

function columnFilters(eb: Eb, filter: SearchFilter) {
  const parts = [];
  if (filter.bankId) parts.push(eb('q.bank_id', '=', filter.bankId));
  if (filter.chapterId) parts.push(eb('q.chapter_id', '=', filter.chapterId));
  if (filter.sourceId) parts.push(eb('q.source_id', '=', filter.sourceId));
  if (filter.status) parts.push(eb('q.status', '=', filter.status));
  if (filter.deferred) parts.push(eb('q.deferred_at', 'is not', null));
  if (filter.noAnswer) parts.push(eb(sql`cardinality(q.answer_letters)`, '=', 0));
  return parts;
}

/** The owner's questions matching every given filter, up to a few hundred, oldest first. */
export async function searchQuestions(db: Db, ownerId: string, filter: SearchFilter) {
  const text = filter.text?.trim() ?? '';
  return db
    .selectFrom('question as q')
    .select([
      'q.id',
      'q.bank_id',
      'q.stem',
      'q.source_page',
      'q.source_number',
      'q.status',
      'q.chapter_id',
    ])
    .where('q.owner_id', '=', ownerId)
    .where((eb) =>
      eb.and([
        ...columnFilters(eb, filter),
        ...markFilters(eb, filter),
        ...(text ? [textMatch(eb, text)] : []),
      ]),
    )
    .orderBy('q.created_at')
    .orderBy('q.source_seq')
    .limit(LIMIT)
    .execute();
}
