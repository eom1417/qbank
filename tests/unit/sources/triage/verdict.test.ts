import { describe, expect, it } from 'vitest';
import type { Verdict } from '../../../../src/server/capabilities/sources/domain/triage/judge.js';
import {
  decide,
  needsJudge,
} from '../../../../src/server/capabilities/sources/domain/triage/verdict.js';

const none = new Set<string>();
const judge = (letter: string | null, decisive = true): Verdict => ({ letter, decisive, why: '' });

describe('the triage answer rule', () => {
  it('trusts two solvers that agree with the file, or answer when the file has none', () => {
    expect(decide({ file: 'B', first: 'B', second: 'B' }, null, none)).toEqual({
      kind: 'confirmed',
    });
    expect(decide({ file: null, first: 'C', second: 'C' }, null, none)).toEqual({
      kind: 'answered',
      letter: 'C',
      how: 'consensus',
    });
    expect(needsJudge({ file: 'B', first: 'B', second: 'B' })).toBe(false);
  });

  it('asks the judge on any disagreement or missing answer', () => {
    expect(needsJudge({ file: 'B', first: 'C', second: 'C' })).toBe(true);
    expect(needsJudge({ file: null, first: 'A', second: 'C' })).toBe(true);
    expect(needsJudge({ file: 'A', first: 'A', second: 'C' })).toBe(true);
    expect(needsJudge({ file: null, first: null, second: null })).toBe(true);
  });
});

describe('the triage answer rule against the file', () => {
  it('overturns the file only when both solvers and the judge agree against it (DEC-16)', () => {
    const votes = { file: 'B', first: 'C', second: 'C' };
    expect(decide(votes, judge('C'), none)).toEqual({
      kind: 'corrected',
      letter: 'C',
      fileLetter: 'B',
    });
    expect(decide({ file: 'B', first: 'C', second: 'D' }, judge('C'), none)).toEqual({
      kind: 'unsettled',
    });
    expect(decide(votes, judge('B'), none)).toEqual({ kind: 'confirmed' });
  });

  it('confirms the file when the judge and one solver side with it, even unsure', () => {
    const votes = { file: 'C', first: 'B', second: 'C' };
    expect(decide(votes, judge('C', false), none)).toEqual({ kind: 'confirmed' });
    const against = { file: 'B', first: 'A', second: 'A' };
    expect(decide(against, judge('B', false), none)).toEqual({ kind: 'unsettled' });
    expect(decide({ file: 'D', first: 'C', second: 'C' }, judge('C', false), none)).toEqual({
      kind: 'unsettled',
    });
  });

  it('never lets an added option beat the file: it is dropped as a bad distractor', () => {
    const votes = { file: 'A', first: 'D', second: 'D' };
    expect(decide(votes, judge('D'), new Set(['D']))).toEqual({ kind: 'bad_option', letter: 'D' });
  });

  it('settles a split with no file answer only when the judge sides with a solver', () => {
    const split = { file: null, first: 'A', second: 'C' };
    expect(decide(split, judge('C'), none)).toEqual({
      kind: 'answered',
      letter: 'C',
      how: 'judged',
    });
    expect(decide(split, judge('D'), none)).toEqual({ kind: 'unsettled' });
    expect(decide(split, judge('C', false), none)).toEqual({ kind: 'unsettled' });
    expect(decide(split, null, none)).toEqual({ kind: 'unsettled' });
  });
});
