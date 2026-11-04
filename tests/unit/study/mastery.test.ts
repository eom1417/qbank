import { describe, expect, it } from 'vitest';
import {
  levelOf,
  nextDue,
  stateOf,
  type Attempt,
} from '../../../src/server/capabilities/study/domain/mastery.js';
import { mixCounts } from '../../../src/server/capabilities/study/domain/smart-mix.js';

const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n));
const record = (...results: [boolean, number][]): Attempt[] =>
  results.map(([correct, d]) => ({ correct, at: day(d) }));

describe('mastery (FR-15-001…004, UAT-060…062)', () => {
  it('one right answer is learning, never mastered; repeated success grows step by step', () => {
    expect(levelOf(record([true, 0]))).toBe('learning');
    expect(levelOf(record([true, 0], [true, 2]))).toBe('good');
    expect(levelOf(record([true, 0], [true, 2], [true, 4], [true, 5]))).toBe('good');
    expect(levelOf(record([true, 0], [true, 2], [true, 4], [true, 8]))).toBe('mastered');
  });

  it('two wrong in the last three is weak, and it does not stay weak after steady success', () => {
    expect(levelOf(record([false, 0], [true, 1], [false, 2]))).toBe('weak');
    expect(levelOf(record([false, 0], [false, 1], [true, 2], [true, 3], [true, 4]))).toBe('good');
  });

  it('a wrong answer after success brings the review back to the next day', () => {
    const good = record([true, 0], [true, 2], [true, 4]);
    expect(nextDue(good)).toEqual(day(12));
    expect(nextDue([...good, { correct: false, at: day(5) }])).toEqual(day(6));
    expect(stateOf(good, day(12))).toMatchObject({ streak: 3, isDue: true, level: 'good' });
    expect(stateOf([], day(1))).toMatchObject({ level: 'new', due: null, isDue: false });
  });
});

describe('Smart Mix counts (FR-14-001, FR-14-002, UAT-057, UAT-058)', () => {
  it('20 with plenty is 10 new, 6 weak, 4 due', () => {
    expect(mixCounts(20, { new: 50, weak: 50, due: 50 })).toEqual({ new: 10, weak: 6, due: 4 });
  });

  it('with only 2 new the rest moves to the other groups by their shares', () => {
    expect(mixCounts(20, { new: 2, weak: 50, due: 50 })).toEqual({ new: 2, weak: 11, due: 7 });
  });

  it('custom shares, and a session as full as the questions allow', () => {
    expect(mixCounts(20, { new: 50, weak: 50, due: 50 }, { new: 30, weak: 50, due: 20 })).toEqual({
      new: 6,
      weak: 10,
      due: 4,
    });
    expect(mixCounts(20, { new: 3, weak: 2, due: 1 })).toEqual({ new: 3, weak: 2, due: 1 });
  });
});
