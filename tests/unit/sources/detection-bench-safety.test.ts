import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { silentCount } from '../../../src/server/tools/detection-bench/report.js';
import { TruthFile } from '../../../src/server/tools/extraction-bench/truth.js';
import { pipelineQuestion } from '../../support/lesson-world.js';

const truth = TruthFile.parse(
  JSON.parse(readFileSync('tests/fixtures/detection/arabic-rtl.truth.json', 'utf8')),
);
const sample = truth.questions[0];
if (!sample) throw new Error('missing sample question');
const question = pipelineQuestion('ABCD', {
  number: sample.printed ?? 1,
  stem: sample.stem,
  page: sample.pages[0] ?? 1,
  pages: sample.pages,
  options: sample.options.map((option) => ({ ...option, label: option.letter, spot: null })),
  answers: sample.answer,
  reviewReasons: [],
});

it('counts corrupted option words even when their letters still match', () => {
  const options = question.options.map((option, at) =>
    at === 0 ? { ...option, text: 'corrupted option' } : option,
  );
  expect(silentCount(truth, [{ ...question, options }])).toBe(1);
});

it('counts unmatched unreviewed extra questions as silent errors', () => {
  const extra = pipelineQuestion('AB', {
    number: 900,
    page: 50,
    pages: [50],
    stem: 'An unrelated extra question?',
  });
  expect(silentCount(truth, [question, extra])).toBe(1);
  expect(silentCount(truth, [{ ...extra, reviewReasons: ['detection_doubt'] }])).toBe(0);
});
