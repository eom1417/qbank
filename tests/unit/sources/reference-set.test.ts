import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  kindMatches,
  markMatches,
  referenceSet,
} from '../../../src/server/capabilities/sources/domain/pipeline/reference-set.js';

// M34 P6 (Q15): the weekly measurement's reference set is drawn in code, the same every time.

const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');

describe('the built-in reference set', () => {
  it('draws the same pixels every time', () => {
    const first = referenceSet();
    const second = referenceSet();
    const pixels = (set: typeof first) =>
      [...set['D4.mark'], ...set['D1.2']].map((item) => digest(item.image.data));
    expect(pixels(first)).toEqual(pixels(second));
    expect(new Set(pixels(first)).size).toBe(pixels(first).length);
  });

  it('carries a circled answer, an unmarked question and a struck-out option for D4.mark', () => {
    const marks = referenceSet()['D4.mark'];
    expect(marks.map((item) => item.expected.letter)).toContain(null);
    expect(marks.some((item) => item.expected.eliminated.length > 0)).toBe(true);
    for (const item of marks) {
      expect(item.image.data.length).toBe(item.image.width * item.image.height * 3);
      // The pen's blue appears exactly when a letter is circled.
      const blue = item.image.data.some(
        (_, at) => at % 3 === 2 && item.image.data[at] === 200 && item.image.data[at - 2] === 30,
      );
      expect(blue).toBe(item.expected.letter !== null);
    }
  });

  it('compares a reply with the expected answer', () => {
    const [circledA, , , withCross] = referenceSet()['D4.mark'];
    if (!circledA || !withCross) throw new Error('missing reference items');
    expect(markMatches(circledA, { letter: 'A', eliminated: [] })).toBe(true);
    expect(markMatches(circledA, { letter: 'b', eliminated: [] })).toBe(false);
    expect(markMatches(withCross, { letter: 'B', eliminated: ['C'] })).toBe(true);
    expect(markMatches(withCross, { letter: 'B', eliminated: [] })).toBe(false);
    const [printed] = referenceSet()['D1.2'];
    if (!printed) throw new Error('missing reference items');
    expect(kindMatches(printed, { kind: 'printed_words' })).toBe(true);
    expect(kindMatches(printed, { kind: 'picture' })).toBe(false);
  });
});
