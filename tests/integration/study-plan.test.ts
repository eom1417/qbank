import { describe, expect, it } from 'vitest';
import { ownerWithBank, type createClient } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { answer, itemAt, startTutor } from '../support/study.js';

let now = new Date('2026-11-04T08:00:00.000Z');
const days = (n: number) => (now = new Date(now.getTime() + n * 24 * 3600 * 1000));
const { app, seed } = useReviewSuite({ clock: { now: () => now } });
type Browser = ReturnType<typeof createClient>;
const many = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => ({ stem: `${tag} question ${i + 1}?` }));

/** Answers the next `wrong` new questions wrong and `right` new ones right, in one session. */
async function study(owner: Browser, bankId: string, wrong: number, right: number) {
  const id = await startTutor(owner, bankId, wrong + right, 'new');
  for (let p = 0; p < wrong + right; p++) await answer(owner, id, p, p < wrong ? ['A'] : ['B']);
}
const smartMix = (owner: Browser, bankId: string, size: number, shares?: object) =>
  owner.post('/api/study/sessions', {
    scope: { bankIds: [bankId] },
    kind: 'smart_mix',
    size,
    mode: 'tutor',
    ...(shares ? { shares } : {}),
  });

describe('Smart Mix (FR-14-001…008, UAT-057, UAT-058, JY-11, JY-12)', () => {
  it('with plenty: 20 is 10 new, 6 weak, 4 due, each question saying why', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(30, 'Plenty'));
    await study(owner, bankId, 10, 10);
    days(3);
    const preview = (
      await owner.post('/api/study/preview', { scope: { bankIds: [bankId] }, kind: 'smart_mix' })
    ).json();
    expect(preview).toEqual({ available: 30, groups: { new: 10, weak: 10, due: 10 } });
    const session = (await smartMix(owner, bankId, 20)).json();
    expect(session).toMatchObject({
      kind: 'smart_mix',
      total: 20,
      mix: { new: 10, weak: 6, due: 4 },
    });
    expect(['new', 'weak', 'due']).toContain((await itemAt(owner, session.id, 0)).json().reason);
  });

  it('with only 2 new the rest is moved by the declared rule and the real counts are shown', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(12, 'Short'));
    await study(owner, bankId, 5, 5);
    days(3);
    expect((await smartMix(owner, bankId, 12)).json().mix).toEqual({ new: 2, weak: 5, due: 5 });
    const custom = await smartMix(owner, bankId, 10, { new: 30, weak: 50, due: 20 });
    expect(custom.json().mix).toEqual({ new: 2, weak: 5, due: 3 });
    expect((await smartMix(owner, bankId, 10, { new: 30, weak: 30, due: 30 })).statusCode).toBe(
      400,
    );
  });
});

describe('mastery and reviews (FR-15-002…008, UAT-060…063, JY-13)', () => {
  it('one right answer is not mastery; a wrong one after success brings the review to tomorrow', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [qid] = await seed(owner, bankId, many(1, 'Single'));
    await study(owner, bankId, 0, 1);
    const mastery = async () => (await owner.get(`/api/study/questions/${qid}/mastery`)).json();
    expect(await mastery()).toMatchObject({ level: 'learning', streak: 1, intervalDays: 2 });
    days(2);
    const again = await startTutor(owner, bankId, 1, 'due');
    await answer(owner, again, 0, ['B']);
    expect(await mastery()).toMatchObject({ level: 'good', streak: 2, intervalDays: 4 });
    days(4);
    const wrong = await startTutor(owner, bankId, 1, 'due');
    await answer(owner, wrong, 0, ['A']);
    expect(await mastery()).toMatchObject({ streak: 0, intervalDays: 1 });
    expect((await owner.get(`/api/study/due?bankIds=${bankId}`)).json().count).toBe(0);
    days(1);
    const due = (await owner.get(`/api/study/due?bankIds=${bankId}`)).json();
    expect(due).toMatchObject({
      count: 1,
      items: [{ questionId: qid, streak: 0, intervalDays: 1 }],
    });
  });

  it('a day with nothing due offers the new and weak ones instead; topics mark small samples', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, many(4, 'Quiet'));
    await study(owner, bankId, 1, 1);
    const due = (await owner.get(`/api/study/due?bankIds=${bankId}`)).json();
    expect(due).toEqual({ count: 0, items: [], alternatives: { new: 2, weak: 1 } });
    const { topics } = (await owner.get(`/api/study/topics?bankIds=${bankId}`)).json();
    expect(topics).toEqual([
      {
        chapterId: null,
        topicId: null,
        questions: 4,
        answered: 2,
        mastery: 0.125,
        weak: 1,
        due: 0,
        smallSample: true,
      },
    ]);
  });
});
