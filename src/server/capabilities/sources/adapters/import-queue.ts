import { sql, type Expression, type SqlBool, type Transaction } from 'kysely';
import type { Db } from '../../../platform/db/index.js';
import type { Database, ImportStage } from '../../../platform/db/schema.js';

/**
 * The server-wide import queue (M31, B2). A job in one of these stages is running while its lease
 * holds and waiting otherwise; an expired lease (a crashed worker) puts it back in the queue.
 * The fair order is round-robin across accounts: an account never runs two imports at once, and
 * the account served least recently goes first.
 */
const ACTIVE_STAGES: readonly ImportStage[] = [
  'queued',
  'reading',
  'extracting',
  'verifying',
  'matching',
];

/** Namespaces the per-account claim lock among the database's advisory locks. */
const CLAIM_LOCK = 3107;

const activeSql = sql.join(ACTIVE_STAGES.map((stage) => sql.lit(stage)));

/** A job of `alias` that has no valid lease: it waits for a worker. */
const waitingSql = (alias: string, now: Date): Expression<SqlBool> =>
  sql<SqlBool>`${sql.ref(`${alias}.stage`)} in (${activeSql}) and (${sql.ref(`${alias}.locked_until`)} is null or ${sql.ref(`${alias}.locked_until`)} < ${now})`;

/** Whether the job's owner has another import running under a valid lease. */
const ownerBusySql = (now: Date): Expression<SqlBool> =>
  sql<SqlBool>`exists (select 1 from import_job r where r.owner_id = j.owner_id and r.stage in (${activeSql}) and r.locked_until >= ${now})`;

/** The owner's last finished import: the account served least recently goes first. */
const lastServedSql = sql`(select max(f.finished_at) from import_job f where f.owner_id = j.owner_id) asc nulls first`;

type Trx = Transaction<Database>;

/** The first waiting job in the fair order, skipping `skipped` owners and rows another holds. */
const firstWaiting = (trx: Trx, now: Date, skipped: readonly string[]) =>
  trx
    .selectFrom('import_job as j')
    .selectAll('j')
    .where(waitingSql('j', now))
    .where((eb) => eb.not(ownerBusySql(now)))
    .$if(skipped.length > 0, (query) => query.where('j.owner_id', 'not in', skipped))
    .orderBy(lastServedSql)
    .orderBy('j.created_at')
    .orderBy('j.id')
    .limit(1)
    .forUpdate()
    .skipLocked()
    .executeTakeFirst();

/**
 * Holds the owner's claim lock for this transaction, then checks again with a fresh snapshot
 * that no other worker started one of the owner's jobs meanwhile (READ COMMITTED).
 */
async function ownerFree(trx: Trx, ownerId: string, jobId: string, now: Date) {
  const lock = await sql<{
    ok: boolean;
  }>`select pg_try_advisory_xact_lock(${CLAIM_LOCK}, hashtext(${ownerId})) as ok`.execute(trx);
  if (!lock.rows[0]?.ok) return false;
  const busy = await trx
    .selectFrom('import_job')
    .select('id')
    .where('owner_id', '=', ownerId)
    .where('id', '!=', jobId)
    .where('stage', 'in', ACTIVE_STAGES)
    .where('locked_until', '>=', now)
    .executeTakeFirst();
  return !busy;
}

/**
 * Takes the next job in the fair order for `leaseMs`; another worker skips it (FOR UPDATE SKIP
 * LOCKED), and never takes a second job of the same account while one runs.
 */
export const claimNext = (db: Db, now: Date, leaseMs: number) =>
  db.transaction().execute(async (trx) => {
    const skipped: string[] = [];
    for (;;) {
      const job = await firstWaiting(trx, now, skipped);
      if (!job) return undefined;
      if (await ownerFree(trx, job.owner_id, job.id, now)) {
        const lockedUntil = new Date(now.getTime() + leaseMs);
        await trx
          .updateTable('import_job')
          .set({ locked_until: lockedUntil })
          .where('id', '=', job.id)
          .execute();
        return job;
      }
      skipped.push(job.owner_id);
    }
  });

/**
 * Waiting jobs ranked by their turn within their account: 1 for each account's next job, plus one
 * when the account already has an import running (that run was its turn).
 */
const rankedWaiting = (now: Date) => sql`waiting as (
  select j.id, j.owner_id, j.created_at, j.pages_total, j.pages_done,
    row_number() over (partition by j.owner_id order by j.created_at, j.id)
      + (${ownerBusySql(now)})::int as turn
  from import_job j where ${waitingSql('j', now)})`;

/**
 * How many waiting jobs start before this one in the fair order: earlier rounds of every
 * account, then this round's earlier jobs. Null when the job is not waiting. A count only.
 */
export async function queuePosition(db: Db, jobId: string, now: Date) {
  const result = await sql<{ n: string }>`with ${rankedWaiting(now)}
    select (select count(*) from waiting w
      where (w.turn, w.created_at, w.id) < (me.turn, me.created_at, me.id)) as n
    from waiting me where me.id = ${jobId}`.execute(db);
  const row = result.rows[0];
  return row ? Number(row.n) : null;
}

export interface QueueRow {
  id: string;
  email: string;
  pages_total: number;
  pages_done: number;
  state: 'running' | 'waiting';
  since: Date;
}

/** The operator's view: running imports, then waiting ones in their fair order. */
export async function listQueue(db: Db, now: Date, limit: number) {
  const result = await sql<QueueRow>`with ${rankedWaiting(now)}
    select * from (
      select j.id, a.email, j.pages_total, j.pages_done, 'running' as state, j.created_at as since,
        0 as turn
      from import_job j join account a on a.id = j.owner_id
      where j.stage in (${activeSql}) and j.locked_until >= ${now}
      union all
      select w.id, a.email, w.pages_total, w.pages_done, 'waiting', w.created_at, w.turn
      from waiting w join account a on a.id = w.owner_id
    ) q order by q.state, q.turn, q.since, q.id limit ${limit}`.execute(db);
  return result.rows;
}
