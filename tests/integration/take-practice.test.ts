import { describe, expect, it } from 'vitest';
import { ShareResultsResponse } from '../../src/contracts/sharing.js';
import { TakeItemResponse } from '../../src/contracts/take.js';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { studySnapshot } from '../support/channels.js';
import { useReviewSuite } from '../support/questions.js';
import { answer, startTutor } from '../support/study.js';
import { answerAll, newShare, storeFigure, takerOf, type PolicyChanges } from '../support/take.js';

const { app, seed } = useReviewSuite();

/** An owner's bank with `count` ready questions (the key is B), shared by a link of `kind`. */
async function linkWith(count: number, kind: 'exam' | 'practice', changes: PolicyChanges = {}) {
  const { owner, bankId } = await ownerWithBank(app());
  const ids = await seed(
    owner,
    bankId,
    Array.from({ length: count }, (_, i) => ({ stem: `Practice ${i + 1}?`, answers: ['B'] })),
  );
  const share = await newShare(owner, bankId, kind, changes);
  return { owner, bankId, ids, share };
}

describe('practice by a link (M30)', () => {
  it('shows the answer right after each question when its policy reveals at once', async () => {
    const { share } = await linkWith(2, 'practice', { content: { size: 2 } });
    const taker = takerOf(app(), share.token);
    await taker.start({ name: 'Practising' });
    const state = (await taker.state()).json();
    expect(state.allowed).toEqual({ navigation: 'free', flag: true, feedbackEachQuestion: true });
    expect((await taker.item(0)).json().feedback).toBeNull();
    const saved = TakeItemResponse.parse((await taker.choose(0, ['A'])).json());
    expect(saved.feedback).toEqual({ correct: false, answers: ['B'], explanation: null });
    expect(saved.changeable).toBe(false);
    expect((await taker.choose(0, ['B'])).json().error.code).toBe('already_answered');
  });

  it('gives no feedback when the policy reveals only the score', async () => {
    const { share } = await linkWith(1, 'practice', {
      content: { size: 1 },
      reveal: { level: 'score' },
    });
    const taker = takerOf(app(), share.token);
    await taker.start({ name: 'Quiet' });
    const saved = await taker.choose(0, ['B']);
    expect([saved.json().feedback, saved.json().changeable]).toEqual([null, true]);
  });
});

describe("an attempt's pictures (M30)", () => {
  it('serves the pictures of questions the attempt asks, and no other', async () => {
    const { ids, share } = await linkWith(2, 'exam', { content: { size: 1 } });
    const pictures = await Promise.all(ids.map((id) => storeFigure(app.db(), id)));
    const taker = takerOf(app(), share.token);
    await taker.start({ name: 'Viewer' });
    const shown = (await taker.item(0)).json().pictureIds as string[];
    const [asked] = shown;
    expect(shown).toHaveLength(1);
    const response = await taker.picture(asked ?? '');
    expect([response.statusCode, response.headers['content-type']]).toEqual([200, 'image/png']);
    const other = pictures.find((id) => id !== asked) ?? '';
    expect((await taker.picture(other)).statusCode).toBe(404);
    expect((await takerOf(app(), share.token).picture(asked ?? '')).statusCode).toBe(401);
  });
});

describe("the owner's results (M30)", () => {
  it("lists each attempt and question, and another account's or an agent's share is not found", async () => {
    const { owner, bankId, share } = await linkWith(2, 'exam', {
      content: { size: 2, passPercent: 50 },
      limits: { attemptsPerPerson: null },
    });
    const good = takerOf(app(), share.token);
    await good.start({ name: 'Good Student', personId: 'S-1' });
    await answerAll(good, 2, ['B']);
    await good.submit();
    await takerOf(app(), share.token).start({ name: 'Just Started' });
    const response = await owner.get(`/api/shares/${share.id}/results`);
    const results = ShareResultsResponse.parse(response.json());
    expect(results.summary).toEqual({ started: 2, submitted: 1, averagePercent: 100, passed: 1 });
    expect(results.attempts[0]).toMatchObject({ name: 'Good Student', percent: 100, passed: true });
    expect(results.attempts[1]).toMatchObject({ status: 'active', correct: null });
    expect(results.questions.map((q) => [q.asked, q.answered, q.correct])).toEqual([
      [2, 1, 1],
      [2, 1, 1],
    ]);
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.get(`/api/shares/${share.id}/results`)).statusCode).toBe(404);
    const agent = await newShare(owner, bankId, 'agent', { content: { size: 1 } });
    const agentId = agent.id;
    expect((await owner.get(`/api/shares/${agentId}/results`)).statusCode).toBe(404);
  });

  it('keeps no names when the share keeps anonymous records', async () => {
    const { owner, share } = await linkWith(1, 'practice', { content: { size: 1 } });
    await takerOf(app(), share.token).start({ name: 'Hidden Name' });
    const response = await owner.get(`/api/shares/${share.id}/results`);
    expect(response.json().attempts[0]).toMatchObject({ name: null, personId: null });
    expect(response.body).not.toContain('Hidden Name');
    const stored = await app.db().selectFrom('channel_attempt').select('person_name').execute();
    expect(stored.map((row) => row.person_name)).not.toContain('Hidden Name');
  });
});

describe('attempts stay apart from study (M30)', () => {
  it("never change the owner's own study numbers, marks or questions", async () => {
    const { owner, bankId, ids, share } = await linkWith(3, 'exam', { content: { size: 3 } });
    const sessionId = await startTutor(owner, bankId, 1);
    await answer(owner, sessionId, 0, ['B']);
    const ownStudy = () => studySnapshot(app.db(), owner, { bankId, sessionId, questionIds: ids });
    const before = await ownStudy();
    const taker = takerOf(app(), share.token);
    await taker.start({ name: 'Outsider' });
    await taker.flag(0, true);
    await answerAll(taker, 3, ['A']);
    await taker.submit();
    expect(await ownStudy()).toEqual(before);
  });
});
