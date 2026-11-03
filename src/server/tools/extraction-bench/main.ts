import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReadingMode } from '../../capabilities/sources/index.js';
import { benchSample, listSamples, type SampleResult } from './run.js';
import { ratios } from './thresholds.js';

// Extraction benchmark (M3.2): `npm run bench:extraction -- [samplesDir] [text,ocr]`.
const dir = process.argv[2] ?? '.data/samples';
const modes = (process.argv[3] ?? 'text,ocr').split(',') as ReadingMode[];

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function row(result: SampleResult): string {
  const r = ratios(result.score);
  const s = result.score;
  const cells = [
    result.sample,
    result.mode,
    `${s.found}/${s.questions}`,
    percent(r['pagesCorrect'] ?? 0),
    percent(r['optionsCorrect'] ?? 0),
    `${s.answerCorrect}/${s.decidable}`,
    String(s.answerWrong),
    String(s.answerAbstained),
    s.stemSimilarity === null ? '—' : percent(s.stemSimilarity),
    `${result.seconds.toFixed(0)} s`,
    result.failures.length === 0 ? 'PASS' : `FAIL: ${result.failures.join('; ')}`,
  ];
  return `| ${cells.join(' | ')} |`;
}

const samples = listSamples(dir);
if (samples.length === 0) {
  console.error(`No samples with answer keys in ${dir}`);
  process.exit(2);
}
const results: SampleResult[] = [];
for (const sample of samples) results.push(...(await benchSample(dir, sample, modes)));
console.log(
  '| sample | mode | questions | pages | options | answers right | wrong | undecided | stem text | time | result |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const result of results) console.log(row(result));
writeFileSync(join(dir, 'bench-results.json'), JSON.stringify(results, null, 2));
process.exit(results.some((result) => result.failures.length > 0) ? 1 : 0);
