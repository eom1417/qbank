import { describe, expect, it } from 'vitest';
import {
  ANSWER_CONFLICT,
  combineEvidence,
  optionNamedByExplanation,
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

  it('takes a lone option the reader trusts, unless the vision lesson struck it out', () => {
    const lone = question('A', ['A'], ['single_option']);
    expect(combineEvidence(lone, null)).toMatchObject({
      answers: ['A'],
      evidence: ['single_option'],
    });
    const struck = combineEvidence(lone, vision(null, ['A']));
    expect(struck.answers).toEqual([]);
    expect(struck.conflicts).toEqual(['single_option=A is struck out (A)']);
    expect(struck.reviewReasons).toEqual([ANSWER_CONFLICT]);
  });

  it('never takes a lone option the reader did not trust (OCR may have lost the others)', () => {
    const lost = question('A', [], [], { reviewReasons: ['incomplete_options', NO_ANSWER] });
    expect(combineEvidence(lost, null)).toMatchObject({
      answers: [],
      reviewReasons: ['incomplete_options', NO_ANSWER],
    });
  });
});

describe('the explanation naming an option (M34 P4b, D4.6)', () => {
  const told = (explanation: string, letters = 'ABC') =>
    pipelineQuestion(letters, {
      explanation,
      options: [
        { letter: 'A', label: 'A', text: 'Alpha blocker', spot: null },
        { letter: 'B', label: 'B', text: 'Beta agonist', spot: null },
        { letter: 'C', label: 'C', text: 'IV', spot: null },
      ].slice(0, letters.length),
    });

  it('takes the option whose full text opens the explanation', () => {
    expect(optionNamedByExplanation(told('Ans: beta-agonist. It relaxes the airway.'))).toBe('B');
    expect(combineEvidence(told('Beta agonist, because it relaxes.'), null)).toMatchObject({
      answers: ['B'],
      evidence: ['explanation_text'],
      reviewReasons: [],
    });
  });

  it('ignores an option named deeper in the text, two named, or a too-short option', () => {
    expect(
      optionNamedByExplanation(told('It relaxes the airway, unlike an alpha blocker.')),
    ).toBeNull();
    expect(optionNamedByExplanation(told('Alpha blocker or beta agonist both act.'))).toBeNull();
    expect(optionNamedByExplanation(told('IV is the route.'))).toBeNull();
    expect(optionNamedByExplanation(told('Alpha blocker', 'A'))).toBeNull();
  });

  it('sends a key the explanation contradicts to review', () => {
    const keyed = {
      ...told('Alpha blocker is right.'),
      answers: ['B'],
      evidence: ['printed_key' as const],
    };
    expect(combineEvidence(keyed, null).conflicts).toEqual([
      'printed_key=B disagrees with explanation_text=A',
    ]);
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

  it('recomputes its own reasons instead of keeping stale ones', () => {
    const stale = question('ABCD', ['B'], ['pen_mark'], {
      reviewReasons: [NO_ANSWER, 'picture_unreadable'],
    });
    expect(combineEvidence(stale, null).reviewReasons).toEqual(['picture_unreadable']);
  });

  it('gives the same result when combined twice', () => {
    const once = combineEvidence(question('ABCD', ['B'], ['pen_mark']), vision('B'));
    expect(combineEvidence(once, vision('B'))).toEqual(once);
  });
});
