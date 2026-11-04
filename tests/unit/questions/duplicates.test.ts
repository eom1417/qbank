import { describe, expect, it } from 'vitest';
import { findPairs } from '../../../src/server/capabilities/questions/domain/duplicates.js';

const q = (id: string, stem: string, options: string[]) => ({
  id,
  stem,
  options: options.map((text, i) => ({ letter: 'ABCD'[i] ?? 'E', text })),
});
const OPTIONS = ['Hypokalemia', 'Hyperkalemia', 'Hypocalcemia', 'Hypomagnesemia'];

describe('finding duplicates (FR-10-001, FR-10-002, UAT-037, UAT-038)', () => {
  it('the same question with other spacing, punctuation and option order is exact', () => {
    const earlier = [q('a', 'Which electrolyte causes peaked T waves?', OPTIONS)];
    const again = [q('b', 'Which  electrolyte causes peaked T-waves', [...OPTIONS].reverse())];
    expect(findPairs(earlier, again)).toEqual([
      { a: 'a', b: 'b', kind: 'exact', similarity: 1, differences: [] },
    ]);
  });

  it('a question that only adds "except" is similar, never exact, and says so', () => {
    const earlier = [
      q('a', 'All of the following cause hyperkalemia in renal failure patients', OPTIONS),
    ];
    const except = [
      q('b', 'All of the following cause hyperkalemia in renal failure patients except', OPTIONS),
    ];
    const [pair] = findPairs(earlier, except);
    expect(pair).toMatchObject({ kind: 'similar', differences: ['except'] });
  });

  it('a different dose is a critical difference; unrelated questions are not paired', () => {
    const earlier = [
      q('a', 'The usual adult dose of drug X for pain relief is', [
        '5 mg',
        '10 mg',
        '20 mg',
        '40 mg',
      ]),
    ];
    const dose = [
      q('b', 'The usual adult dose of drug X for pain relief is', [
        '5 mg',
        '10 mg',
        '20 mg',
        '80 mg',
      ]),
    ];
    expect(findPairs(earlier, dose)[0]?.differences).toEqual(['40', '80']);
    const other = [
      q('c', 'Which nerve supplies the deltoid muscle?', ['Axillary', 'Radial', 'Ulnar', 'Median']),
    ];
    expect(findPairs(earlier, other)).toEqual([]);
  });
});

describe('finding duplicates within one import', () => {
  it('repeats inside the same import are found too, in reading order', () => {
    const pairs = findPairs(
      [],
      [q('a', 'Same question here?', OPTIONS), q('b', 'Same question here?', OPTIONS)],
    );
    expect(pairs).toEqual([{ a: 'a', b: 'b', kind: 'exact', similarity: 1, differences: [] }]);
  });
});
