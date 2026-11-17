import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FileUnits } from '../../capabilities/sources/adapters/pipeline-units.js';
import {
  defaultReaders,
  pipelineQuestions,
  type PipelineReaders,
} from '../../capabilities/sources/use-cases/pipeline-questions.js';
import { extractQuestions } from '../../capabilities/sources/index.js';
import { scorePipeline, type PipelineScore } from './pipeline-score.js';
import { TruthFile } from './truth.js';

// M34 P4a bench: `node --import tsx src/server/tools/extraction-bench/pipeline-bench.ts
// [truthDir] [corpusDir] [outDir] [--baseline] [--cache dir]`. Runs the pipeline (no AI) on
// every truth file and prints numbers only. `--baseline` also counts what the P0 rules
// (text mode) find; `--cache` keeps units (with their OCR words) between runs while iterating.
// Run with OMP_THREAD_LIMIT=1 (see units-report).
const flags = process.argv.slice(2);
const flagValue = (name: string) => {
  const at = flags.indexOf(name);
  return at >= 0 ? flags[at + 1] : undefined;
};
const cacheDir = flagValue('--cache');
const valued = new Set(['--cache', '--only']);
const positional = flags.filter(
  (flag, i) => !flag.startsWith('--') && !valued.has(flags[i - 1] ?? ''),
);
const [truthDir = '.data/truth', corpusDir = '.data/corpus', outDir = '.data/p0/bench'] =
  positional;

/** Readers that keep a file's units (with their OCR words) on disk, keyed by the truth name. */
function cachedReaders(name: string, dir: string): PipelineReaders {
  mkdirSync(dir, { recursive: true });
  const unitsPath = join(dir, `${name}.units.json`);
  return {
    ...defaultReaders,
    units: async (file) => {
      if (existsSync(unitsPath)) return JSON.parse(readFileSync(unitsPath, 'utf8')) as FileUnits;
      const units = await defaultReaders.units(file);
      writeFileSync(unitsPath, JSON.stringify(units));
      return units;
    },
  };
}

interface Row {
  name: string;
  seconds: number;
  score: PipelineScore;
  baselineFound: number | null;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—';

function line(row: Row): string {
  const s = row.score;
  return [
    row.name,
    `${s.found}/${s.expected} (${pct(s.found, s.expected)})`,
    row.baselineFound === null ? '—' : `${row.baselineFound}/${s.expected}`,
    String(s.extra),
    s.stemSimilarity.toFixed(3),
    pct(s.optionsExact, s.found),
    `${s.explanationPlaced}/${s.explanationImages} (${pct(s.explanationPlaced, s.explanationImages)})`,
    `${s.textPicturesAsText}/${s.textPictures}`,
    String(s.leaks),
    `${s.answersCorrect}/${s.answersWrong}/${s.answersUndecided} of ${s.answersDecidable}`,
    String(s.answersUnfounded),
    `${s.explanationFound}/${s.explanationPieces}`,
    String(s.leftovers),
    row.seconds.toFixed(1),
  ].join(' | ');
}

const HEADER =
  'file | found | P0 rules | extra | stem sim | options exact | expl. placed | text pics as text | leaks | answers ok/wrong/undecided | unfounded | expl. text | leftovers | s';

/** Questions the P0 rules (text mode) find, matched the same way. */
async function baselineFound(file: string, truth: TruthFile): Promise<number> {
  const old = await extractQuestions(file, 'text');
  return truth.questions.filter((t) =>
    old.some((q) => q.number === t.printed && t.pages.includes(q.page)),
  ).length;
}

async function benchOne(name: string): Promise<Row> {
  const truth = TruthFile.parse(
    JSON.parse(readFileSync(join(truthDir, `${name}.truth.json`), 'utf8')),
  );
  const file = join(corpusDir, truth.file);
  const readers = cacheDir ? cachedReaders(name, cacheDir) : defaultReaders;
  const started = performance.now();
  const result = await pipelineQuestions(file, readers);
  const seconds = (performance.now() - started) / 1000;
  const units = result.units.pages.flatMap((page) => page.units);
  const score = scorePipeline(truth, result.questions, units, result.leftovers.length);
  const baseline = flags.includes('--baseline') ? await baselineFound(file, truth) : null;
  return { name, seconds, score, baselineFound: baseline };
}

const names = readdirSync(truthDir)
  .filter((entry) => entry.endsWith('.truth.json'))
  .map((entry) => entry.replace(/\.truth\.json$/, ''))
  .filter((name) => !flagValue('--only') || name === flagValue('--only'));
const rows: Row[] = [];
console.log(HEADER);
for (const name of names) {
  const row = await benchOne(name);
  rows.push(row);
  console.log(line(row));
}
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `pipeline-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), rows }, null, 2));
console.log(`written ${out}`);
