import { describe, expect, it } from 'vitest';
import { wordDiff } from '../../../src/web/capabilities/review/diff.js';

describe('word diff (UAT-033)', () => {
  it('marks only the changed words', () => {
    expect(wordDiff('potassium 7.2 rnmol/L today', 'potassium 7.2 mmol/L today')).toEqual([
      { kind: 'same', text: 'potassium 7.2 ' },
      { kind: 'removed', text: 'rnmol/L' },
      { kind: 'added', text: 'mmol/L' },
      { kind: 'same', text: ' today' },
    ]);
  });

  it('handles additions at the end, removals, equal and empty texts', () => {
    expect(wordDiff('A B', 'A B C')).toEqual([
      { kind: 'same', text: 'A B' },
      { kind: 'added', text: ' C' },
    ]);
    expect(wordDiff('A B C', 'A C')).toEqual([
      { kind: 'same', text: 'A ' },
      { kind: 'removed', text: 'B ' },
      { kind: 'same', text: 'C' },
    ]);
    expect(wordDiff('same', 'same')).toEqual([{ kind: 'same', text: 'same' }]);
    expect(wordDiff('', '')).toEqual([]);
  });
});
