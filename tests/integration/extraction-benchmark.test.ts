import { describe, expect, it } from 'vitest';
import { benchSample, listSamples } from '../../src/server/tools/extraction-bench/run.js';

// Regression gate on the owner's reference samples (M3.4, DEC-21). The PDFs are private and not
// in git: they live in .data/samples (or QBANK_SAMPLES_DIR) with their hand-made answer keys.
// A missing sample set fails this test; it is never skipped silently.
const dir = process.env['QBANK_SAMPLES_DIR'] ?? '.data/samples';
const samples = listSamples(dir);

describe('extraction quality on the reference samples', () => {
  it('has reference samples to measure', () => {
    expect(samples.length, `no samples with answer keys in ${dir}`).toBeGreaterThan(0);
  });

  it.each(samples)(
    '%s meets the accepted ratios in text and OCR reading',
    async (sample) => {
      const results = await benchSample(dir, sample, ['text', 'ocr']);
      expect(
        results.flatMap((result) => result.failures.map((f) => `${result.mode}: ${f}`)),
      ).toEqual([]);
    },
    600_000,
  );
});
