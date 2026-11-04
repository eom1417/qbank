import { describe, expect, it } from 'vitest';
import { ownerWithBank } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { answer, itemAt, startTutor } from '../support/study.js';

// Acceptance gaps found in M18 (FR-07-008, FR-10-005, FR-11-005, FR-11-007, FR-16-009, FR-19-008).
const { app, seed } = useReviewSuite();

const preview = async (owner: Awaited<ReturnType<typeof ownerWithBank>>['owner'], bankId: string) =>
  (await owner.post('/api/study/preview', { scope: { bankIds: [bankId] }, kind: 'random' })).json()
    .available;

describe('grading and choosing what is studied', () => {
  it('grades a multiple-select question as a whole, and refuses two picks on a single one', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, [{ stem: 'Select two causes.', answers: ['A', 'C'] }]);
    const both = await startTutor(owner, bankId, 1);
    expect((await answer(owner, both, 0, ['C', 'A'])).json().solution.correct).toBe(true);
    const one = await startTutor(owner, bankId, 1);
    expect((await answer(owner, one, 0, ['A'])).json().solution.correct).toBe(false);
    const { owner: other, bankId: single } = await ownerWithBank(app());
    await seed(other, single, [{ stem: 'One answer only.' }]);
    const session = await startTutor(other, single, 1);
    const refused = await answer(other, session, 0, ['A', 'B']);
    expect([refused.statusCode, refused.json().error.fields]).toEqual([400, { chosen: 'too_big' }]);
  });

  it('never puts the same question twice in an exam (FR-10-005, UAT-040)', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, [
      { stem: 'Same question?' },
      { stem: 'Same question?' },
      { stem: 'Other?' },
    ]);
    const start = (size: number) =>
      owner.post('/api/study/sessions', {
        scope: { bankIds: [bankId] },
        kind: 'random',
        size,
        mode: 'exam',
        timing: { kind: 'none' },
      });
    // Three asked, two different: said plainly, never filled with the copy.
    const refused = await start(3);
    expect([refused.statusCode, refused.json().error.fields]).toEqual([409, { available: '2' }]);
    const { id, total: size } = (await start(2)).json();
    const stems = [];
    for (let p = 0; p < size; p++) stems.push((await itemAt(owner, id, p)).json().stem);
    expect(stems.sort()).toEqual(['Other?', 'Same question?']);
  });
});

describe('what is left out of study', () => {
  it('leaves an excluded question out of study (FR-11-007)', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [first] = await seed(owner, bankId, [{ stem: 'Keep?' }, { stem: 'Exclude me?' }]);
    expect(await preview(owner, bankId)).toBe(2);
    expect((await owner.post(`/api/questions/${first}/exclude`, {})).statusCode).toBe(200);
    expect(await preview(owner, bankId)).toBe(1);
  });

  it('keeps an archived bank out of study, and its results whole when restored (FR-19-008)', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, [{ stem: 'Archived later?' }]);
    await answer(owner, await startTutor(owner, bankId, 1), 0, ['B']);
    const before = (await owner.get(`/api/analytics/summary?bankId=${bankId}`)).json();
    await owner.post(`/api/banks/${bankId}/archive`, {});
    const refused = await owner.post('/api/study/sessions', {
      scope: { bankIds: [bankId] },
      kind: 'smart_mix',
      size: 5,
      mode: 'tutor',
    });
    expect(refused.statusCode).toBeGreaterThanOrEqual(400);
    await owner.post(`/api/banks/${bankId}/restore`, {});
    expect((await owner.get(`/api/analytics/summary?bankId=${bankId}`)).json()).toEqual(before);
  });
});

describe('what results say about questions', () => {
  it('infers difficulty after five answers, never over one the owner set (FR-11-005)', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [{ stem: 'How hard?' }]);
    for (let i = 0; i < 5; i++) await answer(owner, await startTutor(owner, bankId, 1), 0, ['A']);
    const inferred = (await owner.get(`/api/questions/${id}`)).json();
    expect(inferred.difficulty).toEqual({ kind: 'inferred', value: 5 });
    const set = await owner.patch(`/api/questions/${id}`, {
      expectedVersion: inferred.version,
      difficulty: 2,
    });
    expect(set.json().difficulty).toEqual({ kind: 'manual', value: 2 });
    await answer(owner, await startTutor(owner, bankId, 1), 0, ['A']);
    expect((await owner.get(`/api/questions/${id}`)).json().difficulty).toEqual({
      kind: 'manual',
      value: 2,
    });
  });

  it('counts a question as a possible problem when reported and answered wrong (FR-16-009)', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [wrong, reportedOnly] = await seed(owner, bankId, [
      { stem: 'Reported, wrong?' },
      { stem: 'Reported only?' },
    ]);
    for (const id of [wrong, reportedOnly])
      await owner.post(`/api/questions/${id}/reports`, { kind: 'wrong_key' });
    const session = await startTutor(owner, bankId, 2);
    for (const p of [0, 1]) {
      const item = (await itemAt(owner, session, p)).json();
      await answer(owner, session, p, [item.stem === 'Reported, wrong?' ? 'A' : 'B']);
    }
    const summary = (await owner.get(`/api/analytics/summary?bankId=${bankId}`)).json();
    expect(summary.possibleQuestionProblems).toBe(1);
  });
});
