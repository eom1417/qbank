import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { agentOf, bankWith, newShare, policyOf, questionIdsOf } from '../support/channels.js';
import { registeredBrowser } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';

const suite = useReviewSuite();
const { app } = suite;

describe('creating and listing shares (DEC-39)', () => {
  it('shows the secret once: a key for an agent, a link for an exam', async () => {
    const { owner, bankId } = await bankWith(suite, 3);
    const agent = await newShare(owner, bankId, 'agent');
    expect(agent.response.statusCode).toBe(201);
    expect(agent.body).toMatchObject({ link: null, share: { kind: 'agent', version: 1 } });
    expect(agent.key).toMatch(/^qbc_/);
    expect(agent.body.share).toMatchObject({ status: 'active', ready: 3, uses: 0 });
    expect(agent.body.share.bankName).toBe('Medicine');
    const exam = await newShare(owner, bankId, 'exam');
    expect(exam.key).toMatch(/^qbt_/);
    expect(exam.body.link).toBe(`/t/${exam.key}`);
    const list = (await owner.get(`/api/shares?bankId=${bankId}`)).json();
    expect(list.shares.map((s: { kind: string }) => s.kind)).toEqual(['agent', 'exam']);
    expect(JSON.stringify(list)).not.toContain(agent.key);
    expect(JSON.stringify(list)).not.toContain(exam.key);
    expect((await agentOf(app(), exam.key).batch()).statusCode).toBe(401);
  });

  it("lists every share of the account in the hub, and nobody else's", async () => {
    const { owner, bankId } = await bankWith(suite, 1);
    const other = (await owner.post('/api/banks', { name: 'Surgery' })).json();
    await newShare(owner, bankId, 'practice');
    await newShare(owner, other.id, 'agent');
    const { browser: stranger } = await registeredBrowser(app());
    await newShare(stranger, (await stranger.post('/api/banks', { name: 'Mine' })).json().id);
    const hub = (await owner.get('/api/shares')).json();
    expect(hub.shares.map((s: { bankName: string }) => s.bankName)).toEqual([
      'Medicine',
      'Surgery',
    ]);
  });
});

describe('checking a new share', () => {
  it('refuses a policy that does not fit its kind, and questions not ready in the bank', async () => {
    const { owner, bankId } = await bankWith(suite, 1);
    const big = await newShare(owner, bankId, 'agent', { content: { size: 20 } });
    expect(big.response.statusCode).toBe(400);
    expect(big.body.error.fields).toHaveProperty(['policy.content.size']);
    const stray = await newShare(owner, bankId, 'exam', {
      content: { fixedQuestionIds: [randomUUID()] },
    });
    expect(stray.response.statusCode).toBe(400);
    expect(stray.body.error.fields).toEqual({ 'policy.content.fixedQuestionIds': 'not_ready' });
    const unconfirmed = await owner.post(`/api/banks/${bankId}/shares`, {
      kind: 'agent',
      name: 'x',
      policy: policyOf('agent'),
    });
    expect(unconfirmed.statusCode).toBe(400);
  });
});

describe("another account's share", () => {
  it('looks like no share at all, whatever is asked of it', async () => {
    const { owner, bankId } = await bankWith(suite, 1);
    const { id } = await newShare(owner, bankId, 'agent');
    const { browser: stranger } = await registeredBrowser(app());
    const calls = [
      stranger.get(`/api/shares/${id}`),
      stranger.patch(`/api/shares/${id}`, { name: 'Mine now' }),
      stranger.get(`/api/shares/${id}/events`),
      stranger.get(`/api/shares/${id}/stats`),
      stranger.post(`/api/shares/${id}/pause`),
      stranger.post(`/api/shares/${id}/archive`),
      stranger.post(`/api/shares/${id}/secret`),
      stranger.delete(`/api/shares/${id}`),
      stranger.get(`/api/shares?bankId=${bankId}`),
      stranger.post(`/api/banks/${bankId}/shares`, {
        kind: 'agent',
        name: 'x',
        policy: policyOf('agent'),
        rightsConfirmed: true,
      }),
      stranger.post(`/api/banks/${bankId}/shares/exposure`, {
        chapterIds: [],
        fixedQuestionIds: [],
      }),
    ];
    for (const response of await Promise.all(calls)) expect(response.statusCode).toBe(404);
    expect((await stranger.get('/api/shares')).json().shares).toEqual([]);
    expect((await owner.get(`/api/shares/${id}`)).json()).toMatchObject({ name: 'Daily three' });
    expect((await app().inject({ url: '/api/shares' })).statusCode).toBe(401);
  });
});

describe('changing a share', () => {
  it('versions each new policy and keeps an append-only record', async () => {
    const { owner, bankId } = await bankWith(suite, 1);
    const { id } = await newShare(owner, bankId, 'agent');
    const renamed = (await owner.patch(`/api/shares/${id}`, { name: 'Morning' })).json();
    expect(renamed).toMatchObject({ name: 'Morning', version: 1 });
    const policy = policyOf('agent', { limits: { batchesPerDay: 5 } });
    const changed = (await owner.patch(`/api/shares/${id}`, { policy })).json();
    expect(changed).toMatchObject({ version: 2, policy: { limits: { batchesPerDay: 5 } } });
    expect((await owner.patch(`/api/shares/${id}`, { policy })).json().version).toBe(2);
    const wrong = await owner.patch(`/api/shares/${id}`, {
      policy: policyOf('agent', { audience: { access: 'open', askId: false } }),
    });
    expect(wrong.json().error.fields).toEqual({ 'policy.audience.access': 'access_for_kind' });
    for (const control of ['pause', 'pause', 'resume', 'end'])
      expect((await owner.post(`/api/shares/${id}/${control}`)).statusCode).toBe(200);
    expect((await owner.get(`/api/shares/${id}`)).json().status).toBe('ended');
    const { events } = (await owner.get(`/api/shares/${id}/events`)).json();
    expect(events.map((e: { type: string }) => e.type)).toEqual([
      'ended',
      'resumed',
      'paused',
      'policy_changed',
      'renamed',
      'created',
    ]);
    expect(events[3]).toMatchObject({ version: 2, detail: { sections: 'limits', from: 1 } });
  });

  it('keeps an archived share for its record only, until it is deleted', async () => {
    const { owner, bankId } = await bankWith(suite, 1);
    const { id } = await newShare(owner, bankId, 'practice');
    expect((await owner.post(`/api/shares/${id}/archive`)).json().status).toBe('archived');
    for (const refused of [
      await owner.patch(`/api/shares/${id}`, { name: 'Again' }),
      await owner.post(`/api/shares/${id}/resume`),
      await owner.post(`/api/shares/${id}/secret`),
    ])
      expect(refused.json().error.code).toBe('share_ended');
    expect((await owner.get(`/api/shares?bankId=${bankId}`)).json().shares).toHaveLength(1);
    expect((await owner.get(`/api/shares/${id}/events`)).statusCode).toBe(200);
    expect((await owner.delete(`/api/shares/${id}`)).statusCode).toBe(204);
    expect((await owner.get(`/api/shares/${id}`)).statusCode).toBe(404);
    expect((await owner.get(`/api/shares/${id}/stats`)).statusCode).toBe(404);
  });
});

describe('an exam keeps its questions to itself (reservation, DEC-39)', () => {
  it('keeps its scope out of agent shares while it is not archived', async () => {
    const { owner, bankId, ids } = await bankWith(suite, 3);
    const reserved = ids[0] as string;
    const nowhere = randomUUID();
    const scope = { chapterIds: [nowhere], fixedQuestionIds: [reserved] };
    const exam = await newShare(owner, bankId, 'exam', { content: scope });
    await newShare(owner, bankId, 'exam', {
      content: { ...scope, reserve: false, fixedQuestionIds: ids },
    });
    const agent = await newShare(owner, bankId, 'agent', { content: { size: 10 } });
    expect(agent.body.share.ready).toBe(2);
    const batch = (await agentOf(app(), agent.key).batch()).json();
    expect(new Set(questionIdsOf(batch))).toEqual(new Set(ids.slice(1)));
    const exposure = await owner.post(`/api/banks/${bankId}/shares/exposure`, {
      chapterIds: [],
      fixedQuestionIds: [],
    });
    expect(exposure.json()).toEqual({ inScope: 3, exposed: 2, reserved: 1 });
    const narrow = await owner.post(`/api/banks/${bankId}/shares/exposure`, scope);
    expect(narrow.json()).toEqual({ inScope: 1, exposed: 0, reserved: 1 });
    await owner.post(`/api/shares/${exam.id}/archive`);
    expect((await owner.get(`/api/shares/${agent.id}`)).json()).toMatchObject({
      ready: 3,
      uses: 1,
    });
  });
});
