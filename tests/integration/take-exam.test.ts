import { describe, expect, it } from 'vitest';
import {
  StartAttemptResponse,
  TakeItemResponse,
  TakeLandingResponse,
  TakeResultResponse,
  TakeStateResponse,
} from '../../src/contracts/take.js';
import { policyOf } from '../support/channels.js';
import { ownerWithBank } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { answerAll, movableClock, newShare, takerOf, type PolicyChanges } from '../support/take.js';

const clock = movableClock();
const { app, seed } = useReviewSuite({ clock });

/** An owner's bank with `count` ready questions (the key is B), shared by a link. */
async function examWith(
  count: number,
  changes: PolicyChanges = {},
  kind: 'exam' | 'practice' = 'exam',
) {
  const { owner, bankId } = await ownerWithBank(app());
  const ids = await seed(
    owner,
    bankId,
    Array.from({ length: count }, (_, i) => ({ stem: `Exam question ${i + 1}?`, answers: ['B'] })),
  );
  const share = await newShare(owner, bankId, kind, changes);
  return { owner, bankId, ids, share, taker: takerOf(app(), share.token) };
}

const errorOf = (response: { json(): { error: { code: string } } }) => response.json().error.code;

/** Moves the share's lifecycle as the owner's controls do. */
const setShare = (id: string, patch: Record<string, unknown>) =>
  app.db().updateTable('channel').set(patch).where('id', '=', id).execute();

describe('a person takes an exam by its link (M30)', () => {
  it('lands, starts, answers, comes back with the token, submits and sees the score', async () => {
    const { taker, share } = await examWith(4, {
      content: { size: 3, passPercent: 60 },
      reveal: { level: 'score' },
    });
    const landing = TakeLandingResponse.parse((await taker.landing()).json());
    expect(landing).toMatchObject({ kind: 'exam', status: 'active', total: 3 });
    const started = await taker.start({ name: 'Sara Ali' });
    expect(started.statusCode).toBe(201);
    expect(StartAttemptResponse.parse(started.json()).token).toMatch(/^qba_/);
    const stored = await app.db().selectFrom('channel_attempt').selectAll().execute();
    expect(JSON.stringify(stored)).not.toContain(taker.token());
    const first = TakeItemResponse.parse((await taker.item(0)).json());
    expect([first.total, first.feedback, first.changeable]).toEqual([3, null, true]);
    await taker.choose(0, ['B']);
    await taker.choose(1, ['A']);
    const reloaded = takerOf(app(), share.token);
    reloaded.useToken(taker.token());
    const state = TakeStateResponse.parse((await reloaded.state()).json());
    expect(state).toMatchObject({ status: 'active', answered: 2, total: 3, secondsLeft: 1800 });
    expect(state.allowed).toEqual({ navigation: 'free', flag: true, feedbackEachQuestion: false });
    const result = TakeResultResponse.parse((await reloaded.submit()).json());
    expect(result).toMatchObject({ status: 'submitted', endedBy: 'person', level: 'score' });
    expect(result.score).toEqual({ correct: 1, total: 3, percent: 33.3, passed: false });
    expect(result.items).toBeNull();
    expect(errorOf(await reloaded.choose(2, ['B']))).toBe('exam_ended');
  });

  it('never shows an answer before submitting, then the answers and explanations as allowed', async () => {
    const { taker } = await examWith(2, { content: { size: 2 }, reveal: { level: 'explained' } });
    await taker.start({ name: 'Omar' });
    for (const position of [0, 1]) {
      const item = await taker.item(position);
      const saved = await taker.choose(position, ['B']);
      expect(JSON.stringify([item.json(), saved.json()])).not.toMatch(/"answers"|explanation/);
    }
    expect(JSON.stringify((await taker.state()).json())).not.toMatch(/"answers"/);
    expect((await taker.result()).json()).toMatchObject({ status: 'active', items: null });
    const result = TakeResultResponse.parse((await taker.submit()).json());
    expect(result.items?.map((i) => [i.correct, i.answers])).toEqual([
      [true, ['B']],
      [true, ['B']],
    ]);
  });
});

describe('what a person sees after submitting (M30)', () => {
  it('holds the result back until its hours have passed', async () => {
    const { taker } = await examWith(1, {
      content: { size: 1 },
      reveal: { level: 'answers', when: 'after_hours', hours: 2 },
    });
    await taker.start({ name: 'Lina' });
    const now = (await taker.submit()).json();
    expect([now.level, now.score, now.items]).toEqual(['none', null, null]);
    expect(now.moreAt).not.toBeNull();
    clock.advance(2 * 3_600_000);
    const later = (await taker.result()).json();
    expect(later.level).toBe('answers');
    expect(later.score.correct).toBe(0);
  });
});

describe('who may start (M30)', () => {
  it('asks the access code (a wrong one is refused) and never shows it on the landing', async () => {
    const { taker } = await examWith(2, {
      content: { size: 1 },
      audience: { access: 'code', code: 'ward-7', askId: false },
    });
    const landing = await taker.landing();
    expect(landing.json().policy.audience).toEqual({ access: 'code', askId: false });
    expect(landing.body).not.toContain('ward-7');
    const wrong = await taker.start({ name: 'Nour', code: 'ward-8' });
    expect([wrong.statusCode, errorOf(wrong)]).toEqual([403, 'wrong_code']);
    expect(errorOf(await taker.start({ name: 'Nour' }))).toBe('wrong_code');
    expect((await taker.start({ name: 'Nour', code: 'ward-7' })).statusCode).toBe(201);
  });

  it('requires the id when the share asks for it', async () => {
    const { taker } = await examWith(2, {
      content: { size: 1 },
      audience: { access: 'open', askId: true },
    });
    const missing = await taker.start({ name: 'Huda' });
    expect(missing.json().error).toEqual({
      code: 'validation_failed',
      fields: { personId: 'required' },
    });
    expect((await taker.start({ name: 'Huda', personId: 'S-1' })).statusCode).toBe(201);
  });
});

describe('how many may start (M30)', () => {
  it('counts attempts per person by the normalized name', async () => {
    const { share } = await examWith(3, { content: { size: 1 }, limits: { attemptsPerPerson: 1 } });
    expect((await takerOf(app(), share.token).start({ name: 'Sara  Ali' })).statusCode).toBe(201);
    const again = await takerOf(app(), share.token).start({ name: ' sara ali ' });
    expect(errorOf(again)).toBe('attempts_used');
    expect((await takerOf(app(), share.token).start({ name: 'Sara Omar' })).statusCode).toBe(201);
  });

  it('refuses a draw the ready questions cannot fill, and unknown or agent tokens', async () => {
    const { taker, owner, bankId, share, ids } = await examWith(2, { content: { size: 2 } });
    const tooBig = { ...policyOf('exam', { content: { size: 3 } }), presenter: '' };
    const refused = await owner.post(`/api/banks/${bankId}/shares`, {
      kind: 'exam',
      name: 'Too big',
      policy: tooBig,
      rightsConfirmed: true,
    });
    expect(errorOf(refused)).toBe('not_enough_questions');
    expect(errorOf(await owner.patch(`/api/shares/${share.id}`, { policy: tooBig }))).toBe(
      'not_enough_questions',
    );
    // A question leaves the bank after publishing: the link refuses honestly when started.
    expect(
      (await owner.post(`/api/questions/${ids[0]}/delete`, { confirm: true })).statusCode,
    ).toBe(204);
    expect(errorOf(await taker.start({ name: 'Ali' }))).toBe('not_enough_questions');
    expect((await takerOf(app(), 'qbt_unknown').landing()).statusCode).toBe(404);
    const agent = await newShare(owner, bankId, 'agent', { content: { size: 1 } });
    const agentKey = agent.token;
    expect((await takerOf(app(), agentKey).landing()).statusCode).toBe(404);
  });
});

describe('the share decides through its gate (M30)', () => {
  it('refuses starting when scheduled, paused or ended, and hides an archived share', async () => {
    const startsAt = new Date(clock.now().getTime() + 3_600_000).toISOString();
    const scheduled = await examWith(2, { content: { size: 1 }, limits: { startsAt } });
    expect((await scheduled.taker.landing()).json().status).toBe('scheduled');
    expect(errorOf(await scheduled.taker.start({ name: 'Early' }))).toBe('share_not_started');
    const { taker, share } = await examWith(2, { content: { size: 1 } });
    await setShare(share.id, { paused: true });
    expect(errorOf(await taker.start({ name: 'Paused' }))).toBe('channel_paused');
    await setShare(share.id, { paused: false, ended_at: clock.now() });
    expect((await taker.landing()).json().status).toBe('ended');
    expect(errorOf(await taker.start({ name: 'Late' }))).toBe('share_ended');
    await setShare(share.id, { archived_at: clock.now() });
    expect((await taker.landing()).statusCode).toBe(404);
  });

  it("hands in an attempt whose share the owner ended, and hides an archived share's attempts", async () => {
    const { taker, share } = await examWith(2, { content: { size: 2 } });
    await taker.start({ name: 'Rami' });
    await setShare(share.id, { paused: true });
    expect(errorOf(await taker.choose(0, ['B']))).toBe('channel_paused');
    await setShare(share.id, { paused: false, ended_at: clock.now() });
    expect((await taker.state()).json().status).toBe('submitted');
    expect((await taker.result()).json().endedBy).toBe('owner');
    await setShare(share.id, { archived_at: clock.now() });
    expect((await taker.state()).statusCode).toBe(404);
  });

  it("submits by itself when the exam's time is over", async () => {
    const { taker } = await examWith(2, { content: { size: 2 }, limits: { durationSeconds: 600 } });
    await taker.start({ name: 'Timed' });
    await taker.choose(0, ['B']);
    clock.advance(599_000);
    expect((await taker.state()).json().secondsLeft).toBe(1);
    clock.advance(1_000);
    expect(errorOf(await taker.choose(1, ['B']))).toBe('exam_ended');
    const result = (await taker.result()).json();
    expect([result.endedBy, result.score.correct]).toEqual(['time', 1]);
  });
});

describe('inside an attempt (M30)', () => {
  it('forward-only navigation refuses going back to change or reopen a question', async () => {
    const { taker } = await examWith(3, {
      content: { size: 3 },
      limits: { navigation: 'forward' },
    });
    await taker.start({ name: 'Forward' });
    await taker.item(0);
    await taker.choose(0, ['B']);
    expect((await taker.item(2)).statusCode).toBe(200);
    expect(errorOf(await taker.item(1))).toBe('question_locked');
    expect(errorOf(await taker.choose(0, ['A']))).toBe('question_locked');
    expect((await taker.state()).json().allowed.navigation).toBe('forward');
    expect((await taker.item(9)).statusCode).toBe(404);
    expect((await taker.choose(2, ['E'])).json().error.fields).toEqual({ chosen: 'invalid_value' });
  });

  it("keeps each attempt to its own token: a wrong token reads nothing, another's reads its own", async () => {
    const { share } = await examWith(2, {
      content: { size: 1 },
      limits: { attemptsPerPerson: null },
    });
    const mine = takerOf(app(), share.token);
    const theirs = takerOf(app(), share.token);
    await mine.start({ name: 'Mine' });
    await theirs.start({ name: 'Theirs' });
    await mine.flag(0, true);
    await mine.choose(0, ['B']);
    const other = (await theirs.state()).json();
    expect([other.answered, other.items[0].flagged]).toEqual([0, false]);
    const stranger = takerOf(app(), share.token);
    stranger.useToken('qba_not-a-real-token-at-all-0000000000000000000');
    expect((await stranger.state()).statusCode).toBe(401);
    stranger.useToken(share.token);
    expect((await stranger.state()).statusCode).toBe(401);
  });

  it('flags a question and shows it in the state', async () => {
    const { taker } = await examWith(2, { content: { size: 2 } });
    await taker.start({ name: 'Flagger' });
    const flagged = await taker.flag(1, true);
    expect(flagged.json().flagged).toBe(true);
    await answerAll(taker, 2, ['B']);
    const state = (await taker.state()).json();
    expect(state.items.map((i: { flagged: boolean }) => i.flagged)).toEqual([false, true]);
  });
});
