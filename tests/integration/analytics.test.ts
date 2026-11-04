import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { answer, startTutor } from '../support/study.js';

const { app, seed } = useReviewSuite();
const many = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => ({ stem: `${tag} item ${i + 1}?` }));

describe('one definition for every figure (FR-16-001, FR-16-002, UAT-064, UAT-066)', () => {
  it('8 right and 2 wrong is 80% accuracy; pending, duplicate and eligible counts never mix', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, [
      ...many(10, 'Counted'),
      { stem: 'Pending?', status: 'needs_review', reasons: ['duplicate'] },
    ]);
    const id = await startTutor(owner, bankId, 10, 'new');
    for (let p = 0; p < 10; p++) await answer(owner, id, p, p < 8 ? ['B'] : ['A']);
    const summary = (await owner.get(`/api/analytics/summary?bankId=${bankId}`)).json();
    expect(summary.accuracy).toEqual({ part: 8, whole: 10, percent: 80 });
    expect(summary.questions).toMatchObject({
      total: 11,
      eligible: 10,
      needsReview: 1,
      duplicates: 1,
    });
    expect(summary.learning).toMatchObject({ new: 0, answered: 10, weak: 2 });
    const other = (await owner.post('/api/banks', { name: 'Other' })).json().id as string;
    await seed(owner, other, many(3, 'Elsewhere'));
    const filtered = (await owner.get(`/api/analytics/summary?bankId=${other}`)).json();
    expect(filtered).toMatchObject({
      questions: { total: 3 },
      learning: { new: 3, answered: 0 },
      accuracy: { whole: 0, percent: null },
    });
    expect((await owner.get('/api/analytics/summary')).json().questions.total).toBe(14);
  });

  it("refuses another account's bank in every report", async () => {
    const { bankId } = await ownerWithBank(app());
    const { browser: stranger } = await registeredBrowser(app());
    for (const path of [
      `/api/analytics/summary?bankId=${bankId}`,
      `/api/analytics/imports/${bankId}`,
      `/api/search?bankId=${bankId}`,
    ])
      expect((await stranger.get(path)).statusCode).toBe(404);
  });
});

describe('trend, history, import quality and a suggestion (FR-16-003, FR-16-006, FR-16-007, FR-16-010)', () => {
  it('marks a small week, keeps history after a rename, and reports each import apart', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(3, 'Trend'));
    const id = await startTutor(owner, bankId, 3, 'new');
    await answer(owner, id, 0, ['B']);
    const { weeks } = (await owner.get(`/api/analytics/trend?bankId=${bankId}`)).json();
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({
      accuracy: { part: 1, whole: 1, percent: 100 },
      smallSample: true,
    });
    await owner.patch(`/api/banks/${bankId}`, { name: 'Renamed' });
    const { sessions } = (await owner.get(`/api/analytics/sessions?bankId=${bankId}`)).json();
    expect(sessions).toMatchObject([
      { id, bankIds: [bankId], score: { part: 1, whole: 3 }, accuracy: { part: 1, whole: 1 } },
    ]);
    const { sources } = (await owner.get(`/api/analytics/imports/${bankId}`)).json();
    expect(sources).toMatchObject([
      { fileName: 'seeded.pdf', found: 3, eligible: 3, needsReview: 0 },
    ]);
    expect((await owner.get(`/api/analytics/suggestion?bankId=${bankId}`)).json()).toEqual({
      kind: 'new',
      available: 2,
    });
  });
});

describe('search (FR-03-005, FR-17-001, FR-17-006, UI-22)', () => {
  it('finds words in text, options and notes, in any script, and filters by review state', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [potassium, arabic, noted] = await seed(owner, bankId, [
      { stem: 'Which finding is typical of hyperkalemia?' },
      { stem: 'ما العلامة المميزة لفرط بوتاسيوم الدم؟' },
      { stem: 'Plain question?' },
    ]);
    await owner.post(`/api/questions/${noted}/notes`, { body: 'remember the peaked waves' });
    const find = async (query: string) => (await owner.get(`/api/search?${query}`)).json();
    expect((await find('q=HYPERKALEMIA')).results.map((r: { id: string }) => r.id)).toEqual([
      potassium,
    ]);
    expect((await find(`q=${encodeURIComponent('بوتاسيوم')}`)).results[0].id).toBe(arabic);
    expect((await find('q=peaked')).results[0].id).toBe(noted);
    expect((await find('q=Option%20C')).total).toBe(3);
    const id = await startTutor(owner, bankId, 1, 'new');
    await answer(owner, id, 0, ['A']);
    expect((await find('review=wrong')).total).toBe(1);
    expect((await find('review=unanswered')).total).toBe(2);
    expect((await find('q=nothing-like-this')).total).toBe(0);
  });
});
