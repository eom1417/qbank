import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { ownerWithBank, type createClient } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { answer, itemAt, startTutor } from '../support/study.js';
import { seedCase, storeFigure } from '../support/take.js';

// M34 (Z1, Z7, Z8): no explanation picture reaches the owner before the reveal; option pictures
// and the shared case come with the question.

const { app, seed } = useReviewSuite();
const db = () => app.db();
type Browser = ReturnType<typeof createClient>;

/** One question with a picture in every place, sharing a case with a second question. */
async function placedBank(count = 1) {
  const { owner, bankId } = await ownerWithBank(app());
  const stems = Array.from({ length: count }, (_, i) => ({ stem: `Pictured question ${i + 1}?` }));
  const [first = '', ...others] = await seed(owner, bankId, stems);
  const pictures = {
    question: await storeFigure(db(), first, { placement: 'question' }),
    option: await storeFigure(db(), first, { placement: 'option', optionLetter: 'B' }),
    explanation: await storeFigure(db(), first, { placement: 'explanation' }),
    legacy: await storeFigure(db(), first),
    case: await storeFigure(db(), first, { placement: 'case' }),
  };
  await seedCase(db(), [first, ...others], 'A shared vignette.');
  return { owner, bankId, first, pictures };
}

async function startExam(owner: Browser, bankId: string, size: number) {
  const body = { scope: { bankIds: [bankId] }, kind: 'random', size, mode: 'exam' };
  const response = await owner.post('/api/study/sessions', { ...body, timing: { kind: 'none' } });
  return response.json().id as string;
}

describe('pictures in a Tutor session (M34 Z1, Z7, Z8)', () => {
  it('sends question, option and case pictures first, the explanation picture only with the solution', async () => {
    const { owner, bankId, pictures } = await placedBank();
    const id = await startTutor(owner, bankId, 1);
    const before = (await itemAt(owner, id, 0)).json();
    expect(before.pictureIds).toEqual([pictures.question, pictures.legacy]);
    expect(before.optionPictureIds).toEqual({ B: [pictures.option] });
    expect(before.case).toEqual({ text: 'A shared vignette.', pictures: [pictures.case] });
    expect(JSON.stringify(before)).not.toContain(pictures.explanation);
    const after = (await answer(owner, id, 0, ['B'])).json();
    expect(after.solution.pictureIds).toEqual([pictures.explanation]);
    expect(after.pictureIds).toEqual([pictures.question, pictures.legacy]);
  });

  it('shows the same case on every question of that case', async () => {
    const { owner, bankId, pictures } = await placedBank(2);
    const id = await startTutor(owner, bankId, 2);
    const cases = [(await itemAt(owner, id, 0)).json(), (await itemAt(owner, id, 1)).json()];
    for (const item of cases)
      expect(item.case).toEqual({ text: 'A shared vignette.', pictures: [pictures.case] });
  });

  it('keeps the pictures of a session taken before placements existed', async () => {
    const { owner, bankId, pictures } = await placedBank();
    const id = await startTutor(owner, bankId, 1);
    await db()
      .updateTable('study_item')
      .set({ snapshot: sql`snapshot - 'placed'` })
      .where('session_id', '=', id)
      .execute();
    const old = (await itemAt(owner, id, 0)).json();
    expect(old.pictureIds).toEqual([pictures.question, pictures.legacy]);
    expect(old).toMatchObject({ optionPictureIds: {}, case: null });
    expect((await answer(owner, id, 0, ['B'])).json().solution.pictureIds).toEqual([]);
  });
});

describe('pictures in an exam (M34 Z1, Z7)', () => {
  it('holds back the explanation picture until the exam is submitted', async () => {
    const { owner, bankId, pictures } = await placedBank();
    const id = await startExam(owner, bankId, 1);
    const before = (await itemAt(owner, id, 0)).json();
    expect(before.optionPictureIds).toEqual({ B: [pictures.option] });
    expect(JSON.stringify(before)).not.toContain(pictures.explanation);
    const chosen = (
      await owner.put(`/api/study/sessions/${id}/items/0/choice`, { chosen: ['B'] })
    ).json();
    expect(JSON.stringify(chosen)).not.toContain(pictures.explanation);
    await owner.post(`/api/study/sessions/${id}/submit`, { confirm: true });
    const after = (await itemAt(owner, id, 0)).json();
    expect(after.solution.pictureIds).toEqual([pictures.explanation]);
  });
});
