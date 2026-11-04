import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { answer, itemAt, startTutor } from '../support/study.js';

const { app, seed } = useReviewSuite();
const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ stem: `Question number ${i + 1} about a topic?` }));

describe('starting a Tutor session (FR-12-001, FR-03-006, UI-13)', () => {
  it('asks for 20 with only 12 eligible: refused with the number, then 12 works', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, [
      ...many(12),
      { stem: 'Waiting for review?', status: 'needs_review', reasons: ['ocr_page'] },
    ]);
    const preview = (
      await owner.post('/api/study/preview', { scope: { bankIds: [bankId] }, kind: 'random' })
    ).json();
    expect(preview).toEqual({ available: 12 });
    const refused = await owner.post('/api/study/sessions', {
      scope: { bankIds: [bankId] },
      kind: 'random',
      size: 20,
      mode: 'tutor',
    });
    expect([refused.statusCode, refused.json().error]).toEqual([
      409,
      { code: 'not_enough_questions', fields: { available: '12' } },
    ]);
    const id = await startTutor(owner, bankId, 12);
    expect((await owner.get(`/api/study/sessions/${id}`)).json()).toMatchObject({
      total: 12,
      answered: 0,
      status: 'active',
    });
  });

  it('never asks the same question twice in one session, even kept twice in the bank (UAT-059)', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, [
      { stem: 'Same text?' },
      { stem: 'Same text?' },
      { stem: 'Other text?' },
    ]);
    expect(
      (
        await owner.post('/api/study/preview', { scope: { bankIds: [bankId] }, kind: 'random' })
      ).json(),
    ).toEqual({ available: 2 });
  });
});

describe('who may study a bank', () => {
  it("refuses another account's bank", async () => {
    const { bankId } = await ownerWithBank(app());
    const { browser: stranger } = await registeredBrowser(app());
    expect(
      (await stranger.post('/api/study/preview', { scope: { bankIds: [bankId] }, kind: 'random' }))
        .statusCode,
    ).toBe(404);
  });
});

describe('answering (FR-12-003…006, UAT-041, UAT-042, UAT-045, FR-23-007)', () => {
  it('shows no solution before sending; a wrong answer shows the correction; no second attempt', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(1));
    const id = await startTutor(owner, bankId, 1);
    expect((await itemAt(owner, id, 0)).json()).toMatchObject({ solution: null, total: 1 });
    const answered = (await answer(owner, id, 0, ['A'])).json();
    expect(answered.solution).toEqual({
      chosen: ['A'],
      correct: false,
      answers: ['B'],
      explanation: null,
    });
    const again = await answer(owner, id, 0, ['B']);
    expect([again.statusCode, again.json().error.code]).toEqual([409, 'already_answered']);
    expect((await itemAt(owner, id, 0)).json().solution.chosen).toEqual(['A']);
  });

  it('keeps the question as it was when the session began, even after an edit', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [qid] = await seed(owner, bankId, [{ stem: 'Original wording?' }]);
    const id = await startTutor(owner, bankId, 1);
    const q = (await owner.get(`/api/questions/${qid}`)).json();
    await owner.patch(`/api/questions/${qid}`, {
      expectedVersion: q.version,
      stem: 'New wording?',
      answers: ['C'],
    });
    expect((await itemAt(owner, id, 0)).json().stem).toBe('Original wording?');
    expect((await answer(owner, id, 0, ['B'])).json().solution.correct).toBe(true);
  });
});
