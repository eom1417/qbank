import type { Selectable } from 'kysely';
import { sql } from 'kysely';
import { isForeignKeyViolation } from '../../../platform/db/errors.js';
import type { Db } from '../../../platform/db/index.js';
import type { Database, ImportStage } from '../../../platform/db/schema.js';

export type SourceRow = Selectable<Database['source']>;
export type JobRow = Selectable<Database['import_job']>;
export type PageRow = Selectable<Database['import_page']>;

const RUNNING: readonly ImportStage[] = [
  'queued',
  'reading',
  'extracting',
  'verifying',
  'matching',
];

type NewSource = Omit<SourceRow, 'byte_size'> & { byte_size: number };
type NewJob = Pick<
  JobRow,
  | 'id'
  | 'owner_id'
  | 'source_id'
  | 'stage'
  | 'pages_total'
  | 'ai_provider_id'
  | 'created_at'
  | 'updated_at'
>;
type JobChanges = Partial<Omit<JobRow, 'id' | 'owner_id' | 'source_id' | 'created_at'>>;
type NewPage = Omit<PageRow, 'content'> & { content: string };

/** Saves the source and its queued job together; `bank_missing` when the bank is not the owner's. */
async function create(db: Db, source: NewSource, job: NewJob): Promise<'created' | 'bank_missing'> {
  try {
    await db.transaction().execute(async (trx) => {
      await trx.insertInto('source').values(source).execute();
      await trx.insertInto('import_job').values(job).execute();
    });
    return 'created';
  } catch (error) {
    if (isForeignKeyViolation(error)) return 'bank_missing';
    throw error;
  }
}

/**
 * Takes the next runnable job for `leaseMs`; another worker skips it (FOR UPDATE SKIP LOCKED).
 * A lease that ran out (a crashed worker) makes the job runnable again.
 */
const claimNext = (db: Db, now: Date, leaseMs: number) =>
  db.transaction().execute(async (trx) => {
    const job = await trx
      .selectFrom('import_job')
      .selectAll()
      .where('stage', 'in', RUNNING)
      .where((eb) => eb.or([eb('locked_until', 'is', null), eb('locked_until', '<', now)]))
      .orderBy('created_at')
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst();
    if (!job) return undefined;
    const lockedUntil = new Date(now.getTime() + leaseMs);
    await trx
      .updateTable('import_job')
      .set({ locked_until: lockedUntil })
      .where('id', '=', job.id)
      .execute();
    return job;
  });

const savePage = (db: Db, page: NewPage) =>
  db
    .insertInto('import_page')
    .values(page)
    .onConflict((conflict) =>
      conflict.columns(['job_id', 'page_no']).doUpdateSet({
        status: page.status,
        reading: page.reading,
        content: page.content,
        warning: page.warning,
      }),
    )
    .execute();

/** Pages with something to report: read by OCR, unreadable, or failed. */
const reportPages = (db: Db, jobId: string) =>
  db
    .selectFrom('import_page')
    .select(['page_no', 'status', 'reading', 'warning'])
    .where('job_id', '=', jobId)
    .where((eb) => eb.or([eb('status', '!=', 'done'), eb('warning', 'is not', null)]))
    .orderBy('page_no')
    .execute();

/** The bank's sources with their latest import, newest first (UI-23). */
const listSources = (db: Db, ownerId: string, bankId: string) =>
  db
    .selectFrom('source')
    .innerJoin('import_job', 'import_job.source_id', 'source.id')
    .selectAll('source')
    .select(['import_job.id as job_id', 'import_job.stage as job_stage'])
    .where('source.owner_id', '=', ownerId)
    .where('source.bank_id', '=', bankId)
    .orderBy('source.created_at', 'desc')
    .execute();

const countPages = async (db: Db, jobId: string) => {
  const row = await db
    .selectFrom('import_page')
    .select(sql<string>`count(*)`.as('n'))
    .where('job_id', '=', jobId)
    .executeTakeFirstOrThrow();
  return Number(row.n);
};

/** An import of the source that is still queued or being read. */
const runningJobOf = (db: Db, sourceId: string) =>
  db
    .selectFrom('import_job')
    .select('id')
    .where('source_id', '=', sourceId)
    .where('stage', 'in', ['queued', 'reading', 'extracting', 'verifying', 'matching'])
    .executeTakeFirst();

/** Keeps the source and its questions; only the stored original goes (FR-19-001). */
const forgetOriginal = (db: Db, ownerId: string, sourceId: string) =>
  db
    .updateTable('source')
    .set({ blob_key: null })
    .where('owner_id', '=', ownerId)
    .where('id', '=', sourceId)
    .execute();

/** Owner-scoped store of sources, import jobs and their per-page checkpoints. */
export function createImportRepository(db: Db) {
  return {
    create: (source: NewSource, job: NewJob) => create(db, source, job),
    findJob: (ownerId: string, jobId: string) =>
      db
        .selectFrom('import_job')
        .selectAll()
        .where('owner_id', '=', ownerId)
        .where('id', '=', jobId)
        .executeTakeFirst(),
    findSource: (ownerId: string, sourceId: string) =>
      db
        .selectFrom('source')
        .selectAll()
        .where('owner_id', '=', ownerId)
        .where('id', '=', sourceId)
        .executeTakeFirst(),
    reportPages: (jobId: string) => reportPages(db, jobId),
    claimNext: (now: Date, leaseMs: number) => claimNext(db, now, leaseMs),
    update: (jobId: string, changes: JobChanges) =>
      db.updateTable('import_job').set(changes).where('id', '=', jobId).execute(),
    savePage: (page: NewPage) => savePage(db, page),
    pages: (jobId: string) =>
      db
        .selectFrom('import_page')
        .selectAll()
        .where('job_id', '=', jobId)
        .orderBy('page_no')
        .execute(),
    /** A retry reads failed pages again; pages already read are kept (M4.7). */
    forgetFailedPages: (jobId: string) =>
      db
        .deleteFrom('import_page')
        .where('job_id', '=', jobId)
        .where('status', '=', 'failed')
        .execute(),
    listSources: (ownerId: string, bankId: string) => listSources(db, ownerId, bankId),
    runningJobOf: (sourceId: string) => runningJobOf(db, sourceId),
    forgetOriginal: (ownerId: string, sourceId: string) => forgetOriginal(db, ownerId, sourceId),
    removeSource: (ownerId: string, sourceId: string) =>
      db.deleteFrom('source').where('owner_id', '=', ownerId).where('id', '=', sourceId).execute(),
    countPages: (jobId: string) => countPages(db, jobId),
  };
}

export type ImportRepository = ReturnType<typeof createImportRepository>;
