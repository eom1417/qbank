// M34 P6: the units of a pipeline import kept for review (`import_block`, 7 days, Q23): each
// unit's page, place, kind, class, text and role, and the question it became part of.
import type { Db } from '../../../platform/db/index.js';
import type { Box } from '../domain/page.js';
import { parseRole, type BlockRole } from '../domain/pipeline/roles.js';
import type { UnitKind } from '../domain/pipeline/units.js';

export interface StoredBlock {
  /** The unit's id in the file (`p3-u12`): its page and its reading order there. */
  unitId: string;
  page: number;
  order: number;
  box: Box;
  kind: UnitKind;
  imageClass: string | null;
  role: BlockRole;
  text: string | null;
  question: number | null;
}

const KINDS: readonly UnitKind[] = ['text_line', 'image', 'filler'];

interface BlockRow {
  page: number;
  ordinal: number;
  kind: string;
  role: string | null;
  text: string | null;
  box: unknown;
  image_class: string | null;
  question_seq: number | null;
}

function blockOf(row: BlockRow): StoredBlock {
  return {
    unitId: `p${row.page}-u${row.ordinal}`,
    page: row.page,
    order: row.ordinal,
    box: row.box as Box,
    kind: KINDS.find((kind) => kind === row.kind) ?? 'filler',
    imageClass: row.image_class,
    role: parseRole(row.role ?? '') ?? 'dropped',
    text: row.text,
    question: row.question_seq,
  };
}

const COLUMNS = [
  'page',
  'ordinal',
  'kind',
  'role',
  'text',
  'box',
  'image_class',
  'question_seq',
] as const;

/** Rows per insert: well under Postgres's parameter limit. */
const CHUNK = 500;

type Owner = { ownerId: string; jobId: string };

/** Replaces the job's units (a resumed or retried run writes them afresh) until `expiresAt`. */
async function replace(
  db: Db,
  newId: () => string,
  owner: Owner & { expiresAt: Date },
  blocks: readonly StoredBlock[],
) {
  await db.deleteFrom('import_block').where('job_id', '=', owner.jobId).execute();
  for (let at = 0; at < blocks.length; at += CHUNK) {
    const rows = blocks.slice(at, at + CHUNK).map((block) => ({
      id: newId(),
      owner_id: owner.ownerId,
      job_id: owner.jobId,
      page: block.page,
      ordinal: block.order,
      kind: block.kind,
      role: block.role,
      text: block.text,
      box: JSON.stringify(block.box),
      image_class: block.imageClass,
      question_seq: block.question,
      expires_at: owner.expiresAt,
    }));
    await db.insertInto('import_block').values(rows).execute();
  }
}

/** The newest pipeline job of the owner's source that kept units, or null. */
async function latestJob(db: Db, ownerId: string, sourceId: string, now: Date) {
  const row = await db
    .selectFrom('import_block')
    .innerJoin('import_job', 'import_job.id', 'import_block.job_id')
    .select('import_job.id')
    .where('import_job.owner_id', '=', ownerId)
    .where('import_job.source_id', '=', sourceId)
    .where('import_block.expires_at', '>', now)
    .orderBy('import_job.created_at', 'desc')
    .executeTakeFirst();
  return row?.id ?? null;
}

/** The job's unexpired units on these pages, in reading order. */
async function onPages(db: Db, owner: Owner, pages: readonly number[], now: Date) {
  if (pages.length === 0) return [];
  const rows = await db
    .selectFrom('import_block')
    .select(COLUMNS)
    .where('owner_id', '=', owner.ownerId)
    .where('job_id', '=', owner.jobId)
    .where('page', 'in', pages)
    .where('expires_at', '>', now)
    .orderBy('page')
    .orderBy('ordinal')
    .execute();
  return rows.map(blockOf);
}

/** Saves the owner's roles: each unit's role and the question it now belongs to. */
async function setRoles(
  db: Db,
  owner: Owner,
  changes: readonly Pick<StoredBlock, 'page' | 'order' | 'role' | 'question'>[],
) {
  for (const change of changes)
    await db
      .updateTable('import_block')
      .set({ role: change.role, question_seq: change.question })
      .where('owner_id', '=', owner.ownerId)
      .where('job_id', '=', owner.jobId)
      .where('page', '=', change.page)
      .where('ordinal', '=', change.order)
      .execute();
}

export function createBlockRepository(db: Db, newId: () => string) {
  return {
    replace: (owner: Owner & { expiresAt: Date }, blocks: readonly StoredBlock[]) =>
      replace(db, newId, owner, blocks),
    latestJob: (ownerId: string, sourceId: string, now: Date) =>
      latestJob(db, ownerId, sourceId, now),
    onPages: (owner: Owner, pages: readonly number[], now: Date) => onPages(db, owner, pages, now),
    setRoles: (owner: Owner, changes: Parameters<typeof setRoles>[2]) =>
      setRoles(db, owner, changes),
    /** Every unit of a source's imports: they go with its original (Q23). */
    async forgetSource(sourceId: string) {
      await db
        .deleteFrom('import_block')
        .where('job_id', 'in', (eb) =>
          eb.selectFrom('import_job').select('id').where('source_id', '=', sourceId),
        )
        .execute();
    },
    /** Deletes units past their 7 days; returns how many. */
    async purgeExpired(now: Date) {
      const result = await db
        .deleteFrom('import_block')
        .where('expires_at', '<=', now)
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    },
  };
}

export type BlockRepository = ReturnType<typeof createBlockRepository>;
