import { describe, expect, it } from 'vitest';
import {
  ANSWER_CONFLICT,
  combineEvidence,
  KEY_DOUBT,
  MARK_UNCLEAR,
  NO_ANSWER,
  type VisionVerdict,
} from '../../../src/server/capabilities/sources/domain/pipeline/evidence.js';
import type {
  PipelineEvidence,
  PipelineQuestion,
} from '../../../src/server/capabilities/sources/domain/pipeline/question.js';

import { pipelineQuestion } from '../../support/lesson-world.js';

// M34 P4b: D4.6, every branch of combining answer evidence, on synthetic questions.

const question = (
  letters: string,
  answers: string[] = [],
  evidence: PipelineEvidence[] = [],
  extra: Partial<PipelineQuestion> = {},
) => pipelineQuestion(letters, { answers, evidence, ...extra });

const vision = (letter: string | null, eliminated: string[] = []): VisionVerdict => ({
  mark: { letter, eliminated },
});

describe('combining answer evidence (M34 P4b, D4.6)', () => {
  it('takes one positive signal as the answer', () => {
    const keyed = combineEvidence(question('ABCD', ['C'], ['printed_key']), null);
    expect(keyed).toMatchObject({ answers: ['C'], evidence: ['printed_key'], conflicts: [] });
    const seen = combineEvidence(question('ABCD'), vision('B'));
    expect(seen).toMatchObject({ answers: ['B'], evidence: ['vision_mark'], reviewReasons: [] });
    const told = combineEvidence(question('ABC', ['A'], ['explanation_text']), vision(null));
    expect(told).toMatchObject({ answers: ['A'], evidence: ['explanation_text'] });
  });

  it('agrees when the ink and the vision lesson name the same option', () => {
    const both = combineEvidence(question('ABCD', ['D'], ['pen_mark']), vision('D', ['A']));
    expect(both).toMatchObject({
      answers: ['D'],
      evidence: ['pen_mark', 'vision_mark'],
      conflicts: [],
    });
  });

  it('takes a lone option, unless the vision lesson struck it out', () => {
    expect(combineEvidence(question('A'), null)).toMatchObject({
      answers: ['A'],
      evidence: ['single_option'],
    });
    const struck = combineEvidence(question('A'), vision(null, ['A']));
    expect(struck.answers).toEqual([]);
    expect(struck.conflicts).toEqual(['single_option=A is struck out (A)']);
    expect(struck.reviewReasons).toEqual([ANSWER_CONFLICT]);
  });
});

describe('conflicting answer evidence (M34 P4b, D4.6)', () => {
  it('sends two different positives to review without an answer', () => {
    const result = combineEvidence(question('ABCD', ['B'], ['pen_mark']), vision('C'));
    expect(result.answers).toEqual([]);
    expect(result.conflicts).toEqual(['pen_mark=B disagrees with vision_mark=C']);
    expect(result.reviewReasons).toEqual([ANSWER_CONFLICT]);
    expect(result.evidence).toEqual(['pen_mark', 'vision_mark']);
  });

  it('sends a printed key that the hand struck out to review (the audit)', () => {
    const result = combineEvidence(question('ABCD', ['A'], ['printed_key']), vision(null, ['A']));
    expect(result.answers).toEqual([]);
    expect(result.conflicts).toEqual(['printed_key=A is struck out (A)']);
  });

  it('accepts one mark on a key with several letters, but not a mark outside it', () => {
    const several = question('ABCDE', ['B', 'D'], ['printed_key']);
    expect(combineEvidence(several, vision('D')).answers).toEqual(['B', 'D']);
    expect(combineEvidence(several, vision('E')).conflicts).toEqual([
      'printed_key=BD disagrees with vision_mark=E',
    ]);
  });
});

describe('undecided answer evidence (M34 P4b, D4.6)', () => {
  it('leaves a question with no signal undecided for the solvers', () => {
    const result = combineEvidence(question('ABC'), vision(null));
    expect(result).toMatchObject({ answers: [], evidence: ['none'], reviewReasons: [NO_ANSWER] });
    expect(combineEvidence(question('ABC'), null).reviewReasons).toEqual([NO_ANSWER]);
  });

  it('says when the vision lesson itself never passed', () => {
    const unread = combineEvidence(question('ABC'), 'review');
    expect(unread.reviewReasons).toEqual([NO_ANSWER, MARK_UNCLEAR]);
    const inked = combineEvidence(question('ABC', ['B'], ['pen_mark']), 'review');
    expect(inked).toMatchObject({ answers: ['B'], reviewReasons: [] });
  });

  it('never takes a doubtful printed key ("D?"), even with a matching mark', () => {
    const doubtful = question('ABCD', ['D'], ['printed_key'], { reviewReasons: [KEY_DOUBT] });
    const result = combineEvidence(doubtful, vision('D'));
    expect(result.answers).toEqual([]);
    expect(result.reviewReasons).toEqual([KEY_DOUBT]);
  });

  it('keeps an earlier conflict and its review', () => {
    const earlier = question('ABC', ['A'], ['printed_key'], { conflicts: ['key_conflict'] });
    const result = combineEvidence(earlier, vision('A'));
    expect(result.answers).toEqual([]);
    expect(result.conflicts).toEqual(['key_conflict']);
    expect(result.reviewReasons).toEqual([ANSWER_CONFLICT]);
  });

  it('gives the same result when combined twice', () => {
    const once = combineEvidence(question('ABCD', ['B'], ['pen_mark']), vision('B'));
    expect(combineEvidence(once, vision('B'))).toEqual(once);
  });
});
