import { describe, expect, it } from 'vitest';
import { sampleOrdinals } from '../../../src/server/tools/extraction-bench/review-sample.js';
import type { TruthQuestion } from '../../../src/server/tools/extraction-bench/truth.js';

const questions = Array.from({ length: 50 }, (_, i) => ({ ordinal: i + 1 }) as TruthQuestion);

describe('review sample (M34 P0)', () => {
  it('draws the same distinct ordinals for the same seed, sorted', () => {
    const first = sampleOrdinals(questions, 30, 1234);
    expect(first).toEqual(sampleOrdinals(questions, 30, 1234));
    expect(new Set(first).size).toBe(30);
    expect([...first].sort((a, b) => a - b)).toEqual(first);
    expect(sampleOrdinals(questions, 30, 99)).not.toEqual(first);
  });

  it('takes every question when the file has fewer than the sample size', () => {
    expect(sampleOrdinals(questions.slice(0, 13), 30, 7)).toHaveLength(13);
  });
});
