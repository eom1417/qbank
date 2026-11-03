import { describe, expect, it } from 'vitest';
import { scoreExtraction, similarity } from '../../../src/server/tools/extraction-bench/score.js';
import { failures } from '../../../src/server/tools/extraction-bench/thresholds.js';

const ref = (number: number, answer: string | null, evidence = 'circle') => ({
  number,
  page: 1,
  options: ['A', 'B'],
  answer,
  evidence,
});
const got = (number: number, answer: string | null, page = 1) => ({
  number,
  page,
  stem: 'Stem',
  kind: 'mcq' as const,
  options: [
    { letter: 'A', label: 'A', text: 'a' },
    { letter: 'B', label: 'B', text: 'b' },
  ],
  answer,
  evidence: answer ? ('pen_mark' as const) : null,
  spans: [],
  answers: answer ? [answer] : [],
  conflicts: [],
  multiSelect: false,
  explanation: null,
});

describe('extraction benchmark scoring (M3.2)', () => {
  it('counts found, right, wrong and undecided answers; notes are not scored', () => {
    const score = scoreExtraction(
      [ref(1, 'A'), ref(2, 'B'), ref(3, 'A'), ref(4, 'B', 'note'), ref(5, 'A')],
      [got(1, 'A'), got(2, 'A'), got(3, null), got(4, 'B', 2), got(9, null)],
      null,
    );
    expect(score).toMatchObject({
      questions: 5,
      found: 4,
      extra: 1,
      pageCorrect: 3,
      optionsCorrect: 4,
      decidable: 4,
      answerCorrect: 1,
      answerWrong: 1,
      answerAbstained: 2,
      stemSimilarity: null,
    });
  });

  it('measures text similarity and fails a mode below its thresholds', () => {
    expect(similarity('Peaked  T waves', 'peaked t waves')).toBe(1);
    expect(similarity('abcd', 'abcf')).toBe(0.75);
    const perfect = scoreExtraction([ref(1, 'A')], [got(1, 'A')], null);
    expect(failures('text', perfect)).toEqual([]);
    const wrong = scoreExtraction([ref(1, 'A')], [got(1, 'B')], null);
    expect(failures('text', wrong)).toEqual([
      'answersCovered 0.000 vs 0.85',
      'answersWrongMax 1.000 vs 0.02',
    ]);
  });
});
