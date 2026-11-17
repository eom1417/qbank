import { describe, expect, it } from 'vitest';
import type { PipelineQuestion } from '../../../src/server/capabilities/sources/domain/pipeline/question.js';
import {
  questionsToAsk,
  withEvidence,
  type EvidenceDeps,
} from '../../../src/server/capabilities/sources/use-cases/pipeline-evidence.js';
import {
  blank,
  maskedBoxes,
  type QuestionCrop,
} from '../../../src/server/capabilities/sources/adapters/question-crops.js';
import {
  crop,
  LIGHT,
  lessonWorld,
  pipelineQuestion,
  recorded,
  STRONG,
} from '../../support/lesson-world.js';

// M34 P4b: the evidence step on RECORDED replies: who is asked, the audit, the pause.

const q = (n: number, letters = 'ABCD', keyed: string | null = null) =>
  pipelineQuestion(letters, {
    key: `1-${n}-0`,
    number: n,
    answers: keyed ? [keyed] : [],
    evidence: keyed ? ['printed_key'] : [],
  });

/** Crops without poppler: one grey picture per question, its number as the fingerprint. */
const fakeCrops = async (_file: string, questions: readonly PipelineQuestion[]) =>
  questions.map((question): QuestionCrop => ({
    key: question.key,
    image: crop(question.number),
    fingerprint: `fp-${question.key}`,
  }));

const depsOf = (world: ReturnType<typeof lessonWorld>): EvidenceDeps => ({
  ...world.deps,
  cropQuestions: fakeCrops,
});

describe('choosing what the vision lesson sees (M34 P4b)', () => {
  it('asks every unkeyed question and every tenth keyed one, never one without an area', () => {
    const keyed = Array.from({ length: 21 }, (_, i) => q(i + 1, 'ABCD', 'A'));
    const blind = { ...q(30), area: [] };
    const chosen = questionsToAsk([q(40), ...keyed, blind, q(41, 'A')]);
    expect(chosen.asked.map((x) => x.number)).toEqual([40, 41, 1, 11, 21]);
    expect(chosen.audited.map((x) => x.number)).toEqual([1, 11, 21]);
    expect(questionsToAsk(keyed, 0).asked).toEqual([]);
  });
});

describe('the answer-evidence step (M34 P4b)', () => {
  it('decides by the mark, flags an audit that disagrees, and records usage', async () => {
    const reply = {
      items: [
        { n: 1, letter: 'C', eliminated: [] },
        { n: 2, letter: null, eliminated: [] },
        { n: 3, letter: 'B', eliminated: [] },
      ],
    };
    const world = lessonWorld({ [LIGHT]: [recorded(reply)], [STRONG]: [recorded(reply)] });
    const questions = [q(1), q(2), q(3, 'ABCD', 'D')];
    const run = await withEvidence(depsOf(world), 'synthetic.pdf', questions);
    expect(run.asked).toEqual(['1-1-0', '1-2-0', '1-3-0']);
    expect(run.audited).toEqual(['1-3-0']);
    expect(run.questions.map((x) => x.answers)).toEqual([['C'], [], []]);
    expect(run.questions[1]?.reviewReasons).toEqual(['no_answer']);
    expect(run.questions[2]?.conflicts).toEqual(['printed_key=D disagrees with vision_mark=B']);
    expect(run.marks[0]).toEqual({
      key: '1-1-0',
      verdict: { mark: { letter: 'C', eliminated: [] } },
    });
    // The audit's contradiction re-asks the sheet with the strong model, which confirms it.
    expect(run.usage).toHaveLength(2);
    expect(run.paused).toBe(false);
  });

  it('keeps a keyed question it did not audit as the key says, without a call', async () => {
    const world = lessonWorld({});
    const run = await withEvidence(depsOf(world), 'synthetic.pdf', [q(1, 'ABC', 'B')], {
      auditEvery: 0,
    });
    expect(world.calls).toHaveLength(0);
    expect(run.questions[0]).toMatchObject({ answers: ['B'], evidence: ['printed_key'] });
  });
});

describe('the answer-evidence step when the lesson does not finish (M34 P4b)', () => {
  it('pauses on a full subscription and returns the unfinished questions unchanged', async () => {
    const world = lessonWorld({ [LIGHT]: [{ ok: false, failure: 'no_quota' }] });
    const questions = [q(1), q(2, 'A')];
    const run = await withEvidence(depsOf(world), 'synthetic.pdf', questions);
    expect(run).toMatchObject({ paused: true, failure: 'no_quota', marks: [] });
    expect(run.resumeAfter).not.toBeNull();
    expect(run.questions).toEqual(questions);
  });

  it('marks a question for review when no model passed its check', async () => {
    const off = recorded({ items: [{ n: 1, letter: 'Q', eliminated: [] }] });
    const world = lessonWorld({ [LIGHT]: [off, off], [STRONG]: [off] });
    const run = await withEvidence(depsOf(world), 'synthetic.pdf', [q(1)]);
    expect(run.marks[0]?.verdict).toBe('review');
    expect(run.questions[0]?.reviewReasons).toEqual(['no_answer', 'mark_unclear']);
  });
});

describe('re-asking a sheet the light model may have misread (M34 P4b)', () => {
  it('asks the whole sheet again with the strong model when a mark contradicts the ink', async () => {
    const inked = { ...q(2), answers: ['A'], evidence: ['pen_mark' as const] };
    const shifted = recorded({
      items: [
        { n: 1, letter: 'A', eliminated: [] },
        { n: 2, letter: 'B', eliminated: [] },
      ],
    });
    const right = recorded({
      items: [
        { n: 1, letter: 'C', eliminated: [] },
        { n: 2, letter: 'A', eliminated: [] },
      ],
    });
    // Q1 rests on the strong model's mark alone, so the light model reads it again (R1).
    const confirm = recorded({ items: [{ n: 1, letter: 'C', eliminated: [] }] });
    const world = lessonWorld({ [LIGHT]: [shifted, confirm], [STRONG]: [right] });
    const run = await withEvidence(depsOf(world), 'synthetic.pdf', [q(1), inked]);
    expect(world.calls.map((call) => call.model)).toEqual([LIGHT, STRONG, LIGHT]);
    expect(run.questions.map((x) => x.answers)).toEqual([['C'], ['A']]);
    expect(run.questions.map((x) => x.reviewReasons)).toEqual([[], []]);
    expect(run.questions[1]?.conflicts).toEqual([]);
    expect(run.usage).toHaveLength(3);
  });
});

describe('blanking printed pictures in a crop (M34 P4b)', () => {
  const spot = (x0: number, y0: number, x1: number, y1: number) => ({
    page: 1,
    box: { x0, y0, x1, y1 },
  });
  const lettered = pipelineQuestion('AB', {
    options: [
      { letter: 'A', label: 'A', text: 'one', spot: spot(40, 100, 50, 110) },
      { letter: 'B', label: 'B', text: 'two', spot: spot(40, 120, 50, 130) },
    ],
  });
  const beside = spot(300, 90, 500, 200);
  const overLetters = spot(30, 95, 200, 125);

  it('blanks a picture beside the options but never one over a letter', () => {
    expect(maskedBoxes(lettered, 1, [beside, overLetters, { ...beside, page: 2 }])).toEqual([
      beside.box,
    ]);
  });

  it('blanks nothing when the letters are unknown or the question is a picture', () => {
    expect(maskedBoxes(pipelineQuestion('AB'), 1, [beside])).toEqual([]);
    expect(maskedBoxes({ ...lettered, fromPicture: true }, 1, [beside])).toEqual([]);
  });

  it('paints the box white in the rendered region', () => {
    const image = { width: 4, height: 2, data: Buffer.alloc(24, 0) };
    blank(image, { x0: 72, y0: 0, x1: 144, y1: 72 }, { x0: 0, y0: 0, x1: 288, y1: 144 }, 1);
    expect([...image.data.subarray(0, 12)]).toEqual([0, 0, 0, 255, 255, 255, 0, 0, 0, 0, 0, 0]);
    expect([...image.data.subarray(12, 24)].every((value) => value === 0)).toBe(true);
  });
});
