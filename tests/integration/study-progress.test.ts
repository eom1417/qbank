import { describe, expect, it } from 'vitest';
import { createClient, ownerWithBank, registeredBrowser } from '../support/client.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { useReviewSuite } from '../support/questions.js';
import { answer, itemAt, startTutor } from '../support/study.js';

const fakeHost = useFakeAiHost();
const { app, seed } = useReviewSuite({ aiHost: () => fakeHost().settings });
const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ stem: `Question ${i + 1} on a subject?` }));

describe('the session summary and retrying mistakes (FR-12-010, FR-12-011, UAT-046)', () => {
  it('10 questions: 5 right, 3 wrong, 2 left; retrying makes a session of exactly 3', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(10));
    const id = await startTutor(owner, bankId, 10);
    for (let p = 0; p < 8; p++) await answer(owner, id, p, p < 5 ? ['B'] : ['A']);
    const summary = (await owner.get(`/api/study/sessions/${id}/summary`)).json();
    expect(summary).toMatchObject({
      total: 10,
      answered: 8,
      correct: 5,
      wrong: 3,
      skipped: 2,
      seconds: 56,
    });
    expect(summary.wrongItems.map((w: { position: number }) => w.position)).toEqual([5, 6, 7]);
    const retry = (await owner.post(`/api/study/sessions/${id}/retry-wrong`, {})).json();
    expect(retry).toMatchObject({ kind: 'retry', total: 3 });
    for (let p = 0; p < 3; p++) await answer(owner, retry.id, p, ['B']);
    const none = await owner.post(`/api/study/sessions/${retry.id}/retry-wrong`, {});
    expect([none.statusCode, none.json().error.code]).toEqual([409, 'nothing_to_retry']);
  });

  it('kinds: "new" leaves answered questions out, "wrong" takes only the missed ones', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(4));
    const id = await startTutor(owner, bankId, 2);
    await answer(owner, id, 0, ['A']);
    await answer(owner, id, 1, ['B']);
    const count = async (kind: string) =>
      (await owner.post('/api/study/preview', { scope: { bankIds: [bankId] }, kind })).json()
        .available;
    expect([await count('new'), await count('wrong'), await count('random')]).toEqual([2, 1, 4]);
  });
});

describe('carrying on elsewhere, flags and the AI explanation (FR-12-007, FR-12-008, FR-08-005)', () => {
  it('another browser of the same account finds the session where it was left (UAT-047)', async () => {
    const { owner, bankId, payload } = await (async () => {
      const { browser, payload: p } = await registeredBrowser(app());
      const bank = (await browser.post('/api/banks', { name: 'Medicine' })).json();
      return { owner: browser, bankId: bank.id as string, payload: p };
    })();
    await seed(owner, bankId, many(3));
    const id = await startTutor(owner, bankId, 3);
    await answer(owner, id, 0, ['B']);
    await owner.post(`/api/study/sessions/${id}/position`, { position: 1 });
    const phone = createClient(app());
    await phone.post('/api/auth/sign-in', { email: payload.email, password: payload.password });
    const { sessions } = (await phone.get('/api/study/sessions')).json();
    expect(sessions[0]).toMatchObject({ id, position: 1, answered: 1 });
    expect((await itemAt(phone, id, 0)).json().solution.correct).toBe(true);
  });
});

describe('flags and the AI explanation (FR-12-007, FR-08-005)', () => {
  it('a flag is found later and is not an answer (UAT-044)', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [flagged] = await seed(owner, bankId, many(3));
    expect((await owner.put(`/api/questions/${flagged}/mark`, { flagged: true })).json()).toEqual({
      flagged: true,
      favorite: false,
    });
    expect(
      (
        await owner.post('/api/study/preview', { scope: { bankIds: [bankId] }, kind: 'flagged' })
      ).json(),
    ).toEqual({ available: 1 });
    expect(
      (
        await owner.post('/api/study/preview', { scope: { bankIds: [bankId] }, kind: 'new' })
      ).json(),
    ).toEqual({ available: 3 });
  });

  it("explains with the user's AI only after the answer, labelled as such (UAT-043)", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(1));
    const id = await startTutor(owner, bankId, 1);
    const explain = () =>
      owner.post(`/api/study/sessions/${id}/items/0/ai-explanation`, {
        instanceId: FAKE_INSTANCES.explainer,
      });
    expect((await explain()).statusCode).toBe(400);
    await answer(owner, id, 0, ['B']);
    expect((await explain()).json()).toMatchObject({
      outcome: 'explained',
      generatedBy: FAKE_INSTANCES.explainer,
      confidence: 'medium',
    });
    expect((await itemAt(owner, id, 0)).json().solution.explanation).toBeNull();
  });
});

describe("choosing the model of the user's AI", () => {
  it('runs on the model chosen, and refuses one the provider does not offer', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(1));
    const id = await startTutor(owner, bankId, 1);
    await answer(owner, id, 0, ['B']);
    const explain = (model: string) =>
      owner.post(`/api/study/sessions/${id}/items/0/ai-explanation`, {
        instanceId: FAKE_INSTANCES.explainer,
        model,
      });
    expect((await explain('fake-small')).json()).toMatchObject({
      generatedBy: `${FAKE_INSTANCES.explainer} · fake-small`,
    });
    expect(fakeHost().asks.at(-1)?.body.model).toBe('fake-small');
    expect((await explain('not-offered')).statusCode).toBe(400);
    expect((await explain('bad model!')).statusCode).toBe(400);
  });
});
