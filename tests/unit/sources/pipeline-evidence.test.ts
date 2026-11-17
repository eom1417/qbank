import { describe, expect, it } from 'vitest';
import type { PipelineQuestion } from '../../../src/server/capabilities/sources/domain/pipeline/question.js';
import {
  questionsToAsk,
  withEvidence,
  type EvidenceDeps,
} from '../../../src/server/capabilities/sources/use-cases/pipeline-evidence.js';
import type { QuestionCrop } from '../../../src/server/capabilities/sources/adapters/question-crops.js';
import {
  crop,
  LIGHT,
  lessonWorld,
  pipelineQuestion,
  recorded,
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
    const world = lessonWorld({ [LIGHT]: [recorded(reply)] });
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
    expect(run.usage).toHaveLength(1);
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
    const world = lessonWorld({ [LIGHT]: [off, off], 'claude-opus-5-5': [off] });
    const run = await withEvidence(depsOf(world), 'synthetic.pdf', [q(1)]);
    expect(run.marks[0]?.verdict).toBe('review');
    expect(run.questions[0]?.reviewReasons).toEqual(['no_answer', 'mark_unclear']);
  });
});
