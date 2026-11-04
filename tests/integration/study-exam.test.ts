import { describe, expect, it } from 'vitest';
import { ownerWithBank, type createClient } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { itemAt } from '../support/study.js';

// The exam's clock is the server's: tests move it by hand.
let now = new Date('2026-11-04T08:00:00.000Z');
const tick = (seconds: number) => (now = new Date(now.getTime() + seconds * 1000));
const { app, seed } = useReviewSuite({ clock: { now: () => now } });
type Browser = ReturnType<typeof createClient>;
const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ stem: `Exam question ${i + 1}?` }));

async function startExam(owner: Browser, bankId: string, size: number, timing: object) {
  const body = { scope: { bankIds: [bankId] }, kind: 'random', size, mode: 'exam', timing };
  return (await owner.post('/api/study/sessions', body)).json() as { id: string; timing: string };
}
const choose = (owner: Browser, id: string, p: number, chosen: string[]) =>
  owner.put(`/api/study/sessions/${id}/items/${p}/choice`, { chosen });
const state = async (owner: Browser, id: string) =>
  (await owner.get(`/api/study/sessions/${id}/exam`)).json();

describe('an exam hides every solution until it is submitted (FR-13-006, FR-07-010, UAT-051, UAT-052)', () => {
  it('saves and changes answers, flags survive, and only the last answer counts', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(5));
    const exam = await startExam(owner, bankId, 5, { kind: 'none' });
    await choose(owner, exam.id, 0, ['A']);
    const changed = (await choose(owner, exam.id, 0, ['B'])).json();
    expect(changed).toMatchObject({ saved: ['B'], solution: null, changeable: true });
    await choose(owner, exam.id, 1, ['A']);
    await choose(owner, exam.id, 2, ['B']);
    await owner.put(`/api/study/sessions/${exam.id}/items/3/flag`, { flagged: true });
    const tutorAnswer = await owner.post(`/api/study/sessions/${exam.id}/items/4/answer`, {
      chosen: ['B'],
      seconds: 1,
    });
    expect(tutorAnswer.statusCode).toBe(400);
    const map = await state(owner, exam.id);
    expect(
      map.items.map((i: { answered: boolean; flagged: boolean }) => [i.answered, i.flagged]),
    ).toEqual([
      [true, false],
      [true, false],
      [true, false],
      [false, true],
      [false, false],
    ]);
    expect(JSON.stringify(map)).not.toMatch(/correct|answers/);
    expect((await owner.post(`/api/study/sessions/${exam.id}/submit`, {})).statusCode).toBe(400);
    const done = (
      await owner.post(`/api/study/sessions/${exam.id}/submit`, { confirm: true })
    ).json();
    expect(done).toMatchObject({ status: 'finished', endedBy: 'owner' });
    const summary = (await owner.get(`/api/study/sessions/${exam.id}/summary`)).json();
    expect(summary).toMatchObject({ total: 5, answered: 3, correct: 2, wrong: 1, skipped: 2 });
    expect((await itemAt(owner, exam.id, 0)).json().solution).toMatchObject({
      chosen: ['B'],
      correct: true,
    });
    expect((await choose(owner, exam.id, 4, ['B'])).json().error.code).toBe('exam_ended');
  });
});

describe('the clock (FR-13-002…004, FR-13-011, FR-13-012, UAT-048…050, UAT-055)', () => {
  it('a total time starts at start, survives leaving, and ends by the server with what was saved', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(3));
    const exam = await startExam(owner, bankId, 3, { kind: 'total', seconds: 120 });
    expect((await state(owner, exam.id)).secondsLeft).toBe(120);
    await choose(owner, exam.id, 0, ['B']);
    tick(100);
    expect((await state(owner, exam.id)).secondsLeft).toBe(20);
    expect((await itemAt(owner, exam.id, 0)).json().saved).toEqual(['B']);
    tick(25);
    const late = await choose(owner, exam.id, 1, ['B']);
    expect([late.statusCode, late.json().error.code]).toEqual([409, 'exam_ended']);
    expect((await owner.get(`/api/study/sessions/${exam.id}`)).json()).toMatchObject({
      status: 'finished',
      endedBy: 'time',
    });
    expect((await owner.get(`/api/study/sessions/${exam.id}/summary`)).json()).toMatchObject({
      answered: 1,
      correct: 1,
      skipped: 2,
    });
  });

  it('per-question time locks a question and never goes back; no timing never ends by time', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(3));
    const exam = await startExam(owner, bankId, 3, { kind: 'per_question', seconds: 30 });
    await owner.post(`/api/study/sessions/${exam.id}/items/0/open`, {});
    await choose(owner, exam.id, 0, ['A']);
    tick(31);
    expect((await choose(owner, exam.id, 0, ['B'])).json().error.code).toBe('question_locked');
    await owner.post(`/api/study/sessions/${exam.id}/items/1/open`, {});
    expect(
      (await owner.post(`/api/study/sessions/${exam.id}/items/0/open`, {})).json().error.code,
    ).toBe('question_locked');
    const untimed = await startExam(owner, bankId, 3, { kind: 'none' });
    tick(24 * 3600);
    expect(await state(owner, untimed.id)).toMatchObject({ status: 'active', secondsLeft: null });
  });
});

describe('changing a key later (FR-07-007, FR-24-004, UAT-031, UAT-086, JY-15)', () => {
  it('shows which past attempts it touches and never rewrites them', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [qid] = await seed(owner, bankId, many(1));
    const ids: string[] = [];
    for (const chosen of [['B'], ['C']]) {
      const exam = await startExam(owner, bankId, 1, { kind: 'none' });
      await choose(owner, exam.id, 0, chosen);
      await owner.post(`/api/study/sessions/${exam.id}/submit`, { confirm: true });
      ids.push(exam.id);
    }
    const impact = (await owner.get(`/api/study/answer-impact?questionId=${qid}&answers=C`)).json();
    expect(impact).toEqual({ attempts: 2, sessions: 2, wouldChange: 2 });
    const q = (await owner.get(`/api/questions/${qid}`)).json();
    await owner.patch(`/api/questions/${qid}`, { expectedVersion: q.version, answers: ['C'] });
    const correct = async (id: string) =>
      (await owner.get(`/api/study/sessions/${id}/summary`)).json().correct;
    expect([await correct(ids[0] ?? ''), await correct(ids[1] ?? '')]).toEqual([1, 0]);
  });
});
