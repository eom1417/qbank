import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createLedger } from '../../src/server/capabilities/channels/adapters/ledger.js';
import { createShareQueries } from '../../src/server/capabilities/channels/adapters/share-queries.js';
import { purgeExpired } from '../../src/server/capabilities/channels/use-cases/purge.js';
import { agentOf, newShare } from '../support/channels.js';
import { ownerWithBank } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';

const { app, seed } = useReviewSuite();

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

/** An attempt at an exam or practice share, as the take transport saves it. */
async function attempt(shareId: string, ownerId: string, started: Date, submitted: Date | null) {
  const id = randomUUID();
  await app
    .db()
    .insertInto('channel_attempt')
    .values({
      id,
      channel_id: shareId,
      owner_id: ownerId,
      version: 1,
      person_name: null,
      person_ref: null,
      person_key: randomUUID(),
      token_hash: randomUUID(),
      status: submitted ? 'submitted' : 'active',
      ended_by: submitted ? 'person' : null,
      total: 1,
      correct: null,
      started_at: started,
      deadline_at: null,
      submitted_at: submitted,
    })
    .execute();
  return id;
}

const remaining = async (table: 'channel_attempt' | 'channel_answer', shareId: string) =>
  (
    await app
      .db()
      .selectFrom(table)
      .select('channel_id')
      .where('channel_id', '=', shareId)
      .execute()
  ).length;

describe('the retention purge (DEC-39)', () => {
  it("deletes only records older than each share's retention, and says so in its record", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, [{ answers: ['B'] }, { answers: ['B'] }]);
    const ownerId = (await owner.get('/api/auth/me')).json().id as string;
    const practice = await newShare(owner, bankId, 'practice', { records: { retentionDays: 30 } });
    await attempt(practice.id, ownerId, daysAgo(40), null);
    await attempt(practice.id, ownerId, daysAgo(50), daysAgo(20));
    await attempt(practice.id, ownerId, daysAgo(1), null);
    const agent = await newShare(owner, bankId, 'agent', { content: { size: 2 } });
    const batch = (await agentOf(app(), agent.key).batch()).json();
    for (const [i, q] of batch.questions.entries())
      await agentOf(app(), agent.key).answer({
        deliveryId: q.deliveryId,
        recipient: `r${i}`,
        choice: ['B'],
      });
    const db = app.db();
    const old = batch.questions[0].deliveryId as string;
    await db
      .updateTable('channel_answer')
      .set({ answered_at: daysAgo(400) })
      .where('delivery_id', '=', old)
      .execute();
    const deps = {
      shares: createShareQueries(db),
      ledger: createLedger(db, { newId: randomUUID, now: () => new Date() }),
    };
    expect(await purgeExpired(deps, new Date())).toBe(2);
    expect(await remaining('channel_attempt', practice.id)).toBe(2);
    expect(await remaining('channel_answer', agent.id)).toBe(1);
    expect((await agentOf(app(), agent.key).stats()).json()).toMatchObject({
      sentTotal: 2,
      answers: 1,
    });
    const events = async (id: string) =>
      (await owner.get(`/api/shares/${id}/events`)).json().events;
    expect((await events(practice.id))[0]).toMatchObject({
      type: 'records_purged',
      detail: { attempts: 1, answers: 0, retentionDays: 30 },
    });
    expect((await events(agent.id))[0]).toMatchObject({
      type: 'records_purged',
      detail: { attempts: 0, answers: 1, retentionDays: 365 },
    });
    expect(await purgeExpired(deps, new Date())).toBe(0);
  });
});
