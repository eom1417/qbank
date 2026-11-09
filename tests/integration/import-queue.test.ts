import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createImportRepository } from '../../src/server/capabilities/sources/adapters/import-repository.js';
import { listQueue } from '../../src/server/capabilities/sources/use-cases/import-queue.js';
import { QueueItem } from '../../src/contracts/operator.js';
import { ownerWithBank } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

const app = useTestApp();
const LEASE_MS = 60_000;
let tick = 0;

/** An account with a bank, as the queue sees it: its id, e-mail and a way to queue files. */
async function account() {
  const { owner, bankId } = await ownerWithBank(app());
  const bank = await app
    .db()
    .selectFrom('bank')
    .select('owner_id')
    .where('id', '=', bankId)
    .executeTakeFirstOrThrow();
  const { email } = await app
    .db()
    .selectFrom('account')
    .select('email')
    .where('id', '=', bank.owner_id)
    .executeTakeFirstOrThrow();
  return { owner, bankId, ownerId: bank.owner_id, email };
}

type Account = Awaited<ReturnType<typeof account>>;

/** Queues one file for the account, each a moment after the last, and returns its job id. */
async function queue(who: Account, pages = 10) {
  const db = app.db();
  const at = new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));
  const sourceId = randomUUID();
  const jobId = randomUUID();
  await db
    .insertInto('source')
    .values({
      id: sourceId,
      owner_id: who.ownerId,
      bank_id: who.bankId,
      file_name: `f${tick}.pdf`,
      byte_size: 1,
      sha256: randomUUID(),
      blob_key: null,
      page_count: pages,
      page_from: 1,
      page_to: pages,
      language: 'en',
      source_type: 'questions',
      created_at: at,
    })
    .execute();
  await db
    .insertInto('import_job')
    .values({
      ...{ id: jobId, owner_id: who.ownerId, source_id: sourceId, stage: 'queued' },
      ...{ pages_total: pages, ai_provider_id: null, created_at: at, updated_at: at },
    })
    .execute();
  return jobId;
}

const repo = () => createImportRepository(app.db());
const claim = (now = new Date()) => repo().claimNext(now, LEASE_MS);
const finish = (jobId: string) =>
  repo().update(jobId, { stage: 'completed', locked_until: null, finished_at: new Date() });
const clearQueue = () => app.db().deleteFrom('import_job').execute();

/** Three files of A, then one of B. */
async function aThenB() {
  await clearQueue();
  const a = await account();
  const b = await account();
  const [a1, a2, a3] = [await queue(a), await queue(a), await queue(a)];
  const b1 = await queue(b);
  return { a, b, a1, a2, a3, b1 };
}

describe('a fair import queue across accounts (M31, B2)', () => {
  it('with one worker, the second account goes second, not fourth', async () => {
    const { a1, a2, a3, b1 } = await aThenB();
    const order: string[] = [];
    for (let job = await claim(); job; job = await claim()) {
      order.push(job.id);
      await finish(job.id);
    }
    expect(order).toEqual([a1, b1, a2, a3]);
  });

  it('with two workers, two accounts run together and one account never twice', async () => {
    const { a1, b1, a2 } = await aThenB();
    const together = await Promise.all([claim(), claim(), claim(), claim()]);
    expect(together.map((job) => job?.id).sort()).toEqual([a1, b1, undefined, undefined].sort());
    expect(await claim()).toBeUndefined();
    await finish(a1);
    expect((await claim())?.id).toBe(a2);
  });

  it('a running job blocks its account; an expired lease is taken again', async () => {
    await clearQueue();
    const a = await account();
    const [a1, a2] = [await queue(a), await queue(a)];
    const start = new Date();
    expect((await claim(start))?.id).toBe(a1);
    expect(await claim(new Date(start.getTime() + LEASE_MS - 1000))).toBeUndefined();
    const later = new Date(start.getTime() + LEASE_MS + 1000);
    expect((await claim(later))?.id).toBe(a1);
    expect(a2).toBeTruthy();
  });
});

describe('the queue position the owner sees (M31, B2)', () => {
  const positionOf = async (who: Account, id: string): Promise<unknown> =>
    (await who.owner.get(`/api/imports/${id}`)).json().queuePosition;

  it('counts the waiting jobs that start first; null once running or finished', async () => {
    const { a, b, a1, a2, a3, b1 } = await aThenB();
    expect(await positionOf(a, a1)).toBe(0);
    expect(await positionOf(b, b1)).toBe(1);
    expect(await positionOf(a, a2)).toBe(2);
    expect(await positionOf(a, a3)).toBe(3);
    await claim();
    expect(await positionOf(a, a1)).toBeNull();
    expect(await positionOf(b, b1)).toBe(0);
    await finish(a1);
    expect(await positionOf(a, a1)).toBeNull();
  });

  it('is a count only: the report names no other account or file', async () => {
    const { b, b1 } = await aThenB();
    const report = (await b.owner.get(`/api/imports/${b1}`)).json();
    expect(typeof report.queuePosition).toBe('number');
    expect(JSON.stringify(report)).not.toMatch(/f1\.pdf|@/);
  });
});

describe("the operator's queue listing (M31, B2)", () => {
  it('lists running imports, then waiting ones in their fair order, with the account', async () => {
    const { a, b, a1, a2, a3, b1 } = await aThenB();
    await claim();
    const items = await listQueue({ imports: repo(), clock: { now: () => new Date() } });
    expect(items.map((item) => [item.jobId, item.state, item.accountEmail])).toEqual([
      [a1, 'running', a.email],
      [b1, 'waiting', b.email],
      [a2, 'waiting', a.email],
      [a3, 'waiting', a.email],
    ]);
    expect(items.every((item) => QueueItem.safeParse(item).success)).toBe(true);
    expect(items[0]).toMatchObject({ pagesTotal: 10, pagesDone: 0 });
  });
});
