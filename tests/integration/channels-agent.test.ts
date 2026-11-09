import { describe, expect, it } from 'vitest';
import { agentOf, bankWith, newChannel, questionIdsOf } from '../support/channels.js';
import { useReviewSuite } from '../support/questions.js';

const suite = useReviewSuite();
const { app } = suite;

/** An owner, a bank with `count` ready questions, and a channel on it. */
async function channelWith(count: number, settings: Parameters<typeof newChannel>[2] = {}) {
  const { owner, bankId, ids } = await bankWith(suite, count);
  const channel = await newChannel(owner, bankId, settings);
  return { owner, bankId, ids, channel, agent: agentOf(app(), channel.key) };
}

describe('an agent takes batches with the channel key (DEC-36)', () => {
  it('sends ready questions without their answers, never twice in a cycle, then starts again', async () => {
    const { ids, agent } = await channelWith(5, { batchSize: 2 });
    const seen: string[] = [];
    for (const size of [2, 2, 1]) {
      const batch = (await agent.batch()).json();
      expect(batch.questions).toHaveLength(size);
      expect(JSON.stringify(batch)).not.toMatch(/"answers"|explanation/);
      seen.push(...questionIdsOf(batch));
    }
    expect(new Set(seen)).toEqual(new Set(ids));
    const next = (await agent.batch()).json();
    expect([next.cycle, next.questions.length]).toEqual([2, 2]);
  });

  it('gives the same batch again for the same key, and stops when told to', async () => {
    const { agent } = await channelWith(2, { batchSize: 2, whenDone: 'stop' });
    const first = (await agent.batch({ key: '2026-11-05' })).json();
    const again = (await agent.batch({ key: '2026-11-05' })).json();
    expect(again.id).toBe(first.id);
    expect(questionIdsOf(again)).toEqual(questionIdsOf(first));
    const after = (await agent.batch({ key: '2026-11-06' })).json();
    expect([after.questions.length, after.done]).toEqual([0, true]);
  });

  it('reveals the answers later, and records each recipient once', async () => {
    const { agent } = await channelWith(1);
    const batch = (await agent.batch()).json();
    const revealed = (await agent.answers(batch.id)).json();
    expect(revealed.answers[0]).toMatchObject({ answers: ['B'] });
    const deliveryId = batch.questions[0].deliveryId;
    const right = await agent.answer({ deliveryId, recipient: 'user-1', choice: ['B'] });
    expect(right.json()).toEqual({ correct: true, answers: ['B'] });
    const wrong = await agent.answer({ deliveryId, recipient: 'user-2', choice: ['A'] });
    expect(wrong.json().correct).toBe(false);
    const twice = await agent.answer({ deliveryId, recipient: 'user-1', choice: ['A'] });
    expect(twice.json().error.code).toBe('already_answered');
    expect((await agent.stats()).json()).toMatchObject({ answers: 2, correct: 1, sentTotal: 1 });
  });
});

describe('a key reaches its own channel only', () => {
  it('refuses a missing, wrong, renewed or deleted key, a paused channel, and another channel', async () => {
    const a = await channelWith(2);
    const b = await channelWith(2);
    const batchOfB = (await b.agent.batch()).json();
    expect((await a.agent.answers(batchOfB.id)).statusCode).toBe(404);
    const otherDelivery = {
      deliveryId: batchOfB.questions[0].deliveryId,
      recipient: 'x',
      choice: ['B'],
    };
    expect((await a.agent.answer(otherDelivery)).statusCode).toBe(404);
    expect((await agentOf(app(), 'qbc_wrong').batch()).statusCode).toBe(401);
    await a.owner.post(`/api/shares/${a.channel.id}/pause`);
    expect((await a.agent.batch()).json().error.code).toBe('channel_paused');
    const renewed = (await a.owner.post(`/api/shares/${a.channel.id}/secret`)).json();
    expect((await a.agent.stats()).statusCode).toBe(401);
    expect((await agentOf(app(), renewed.secret).stats()).statusCode).toBe(200);
    await b.owner.delete(`/api/shares/${b.channel.id}`);
    expect((await b.agent.stats()).statusCode).toBe(401);
  });
});
