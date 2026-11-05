import { describe, expect, it } from 'vitest';
import { agentOf, newChannel, questionIdsOf } from '../support/channels.js';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { answer, startTutor } from '../support/study.js';

const { app, seed } = useReviewSuite();

const QUESTIONS = Array.from({ length: 4 }, (_, i) => ({ stem: `Q${i}?`, answers: ['B'] }));

describe("the owner's channels (DEC-36)", () => {
  it('shows the key once, lists only its prefix, and keeps other accounts out', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const { response, key, id } = await newChannel(owner, bankId);
    expect(response.statusCode).toBe(201);
    expect(key).toMatch(/^qbc_/);
    const list = (await owner.get(`/api/banks/${bankId}/channels`)).json();
    expect(list.channels[0]).toMatchObject({ id, keyPrefix: key.slice(0, 10) });
    expect(JSON.stringify(list)).not.toContain(key);
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.get(`/api/banks/${bankId}/channels`)).statusCode).toBe(404);
    expect((await stranger.get(`/api/channels/${id}/stats`)).statusCode).toBe(404);
    expect((await stranger.delete(`/api/channels/${id}`)).statusCode).toBe(404);
    const invalid = await owner.post(`/api/banks/${bankId}/channels`, { name: 'x', batchSize: 99 });
    expect(invalid.statusCode).toBe(400);
  });
});

describe('a channel stays apart from study (DEC-36)', () => {
  it("never changes the owner's own study, analytics or questions", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const ids = await seed(owner, bankId, QUESTIONS);
    const sessionId = await startTutor(owner, bankId, 1);
    await answer(owner, sessionId, 0, ['B']);
    const db = app.db();
    const snapshot = async () => ({
      summary: (await owner.get(`/api/analytics/summary?bankId=${bankId}`)).json(),
      items: await db
        .selectFrom('study_item')
        .selectAll()
        .where('session_id', '=', sessionId)
        .execute(),
      marks: await db
        .selectFrom('question_mark')
        .selectAll()
        .where('question_id', 'in', ids)
        .execute(),
      questions: await db
        .selectFrom('question')
        .select(['id', 'version', 'difficulty', 'difficulty_kind', 'status'])
        .where('id', 'in', ids)
        .orderBy('id')
        .execute(),
    });
    const before = await snapshot();
    const agent = agentOf(app(), (await newChannel(owner, bankId, { batchSize: 4 })).key);
    const batch = (await agent.batch()).json();
    for (const [i, q] of batch.questions.entries())
      await agent.answer({ deliveryId: q.deliveryId, recipient: `r${i}`, choice: ['A'] });
    expect(questionIdsOf(batch)).toHaveLength(4);
    expect(await snapshot()).toEqual(before);
  });
});

describe('channel numbers and sessions', () => {
  it('keeps each channel its own numbers', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, QUESTIONS);
    const one = await newChannel(owner, bankId, { batchSize: 2 });
    const two = await newChannel(owner, bankId, { batchSize: 1 });
    await agentOf(app(), one.key).batch();
    await agentOf(app(), one.key).batch();
    const stats = async (id: string) => (await owner.get(`/api/channels/${id}/stats`)).json();
    expect(await stats(one.id)).toMatchObject({ sentTotal: 4, batches: 2, ready: 4 });
    expect(await stats(two.id)).toMatchObject({ sentTotal: 0, batches: 0, ready: 4 });
  });

  it('still asks a signed-in browser for its Origin, key or not', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const { key } = await newChannel(owner, bankId);
    const forged = await app().inject({
      method: 'POST',
      url: '/api/channel/v1/batches',
      headers: { authorization: `Bearer ${key}`, cookie: 'qbank_session=x' },
      payload: {},
    });
    expect(forged.json().error.code).toBe('forbidden_origin');
  });
});
