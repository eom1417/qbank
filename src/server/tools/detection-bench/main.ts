import { argumentValue as flagValue } from '../arguments.js';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FileUnits } from '../../capabilities/sources/adapters/pipeline-units.js';
import { detect } from '../../capabilities/sources/detection/detect.js';
import {
  defaultLinesReader,
  type LinesReader,
} from '../../capabilities/sources/detection/lines/read-lines.js';
import { scorePipeline } from '../extraction-bench/pipeline-score.js';
import { TruthFile } from '../extraction-bench/truth.js';
import { CORPUS_DIR, corpusNames, printCorpus } from './corpus.js';
import { header, line, silentCount, type Row } from './report.js';

// M39 bench: `npm run bench:detection -- [--only name] [--cache dir]`. Runs detect() with no AI
// on the hard-case corpus (tests/fixtures/detection) and on every truth file in .data/truth and
// .data/truth-holdout (files under .data/corpus and .data/holdout). Numbers only.
// Run with OMP_THREAD_LIMIT=1. `--cache` keeps units between runs while iterating.

const cacheDir = flagValue('--cache');
const only = flagValue('--only');

interface Target {
  group: string;
  name: string;
  truthPath: string;
  file: string;
}

function cachedReader(name: string, dir: string): LinesReader {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.units.json`);
  return {
    ...defaultLinesReader,
    units: async (file) => {
      if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as FileUnits;
      const units = await defaultLinesReader.units(file);
      writeFileSync(path, JSON.stringify(units));
      return units;
    },
  };
}

const truthNames = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((entry) => entry.endsWith('.truth.json'))
        .map((entry) => entry.replace(/\.truth\.json$/, ''))
    : [];

async function targets(): Promise<Target[]> {
  const names = corpusNames();
  const printed = await printCorpus(names.filter((name) => !only || name === only));
  const corpus = [...printed].map(([name, file]) => ({
    group: 'corpus',
    name,
    file,
    truthPath: join(CORPUS_DIR, `${name}.truth.json`),
  }));
  const real = [
    { group: 'truth', truth: '.data/truth', files: '.data/corpus' },
    { group: 'holdout', truth: '.data/truth-holdout', files: '.data/holdout' },
  ].flatMap(({ group, truth, files }) =>
    truthNames(truth).map((name) => ({
      group,
      name,
      truthPath: join(truth, `${name}.truth.json`),
      file: join(
        files,
        (JSON.parse(readFileSync(join(truth, `${name}.truth.json`), 'utf8')) as TruthFile).file,
      ),
    })),
  );
  return [...corpus, ...real].filter((t) => !only || t.name === only);
}

async function benchOne(target: Target): Promise<Row> {
  const truth = TruthFile.parse(JSON.parse(readFileSync(target.truthPath, 'utf8')));
  const reader = cacheDir ? cachedReader(`${target.group}-${target.name}`, cacheDir) : undefined;
  const started = performance.now();
  const { questions, detection } = await detect(target.file, {
    lessons: null,
    ...(reader ? { reader } : {}),
  });
  const seconds = (performance.now() - started) / 1000;
  const units = detection.file.units.pages.flatMap((page) => page.units);
  const score = scorePipeline(truth, questions, units);
  return {
    group: target.group,
    name: target.name,
    seconds,
    score,
    silent: silentCount(truth, questions),
  };
}

console.log(header());
const rows: Row[] = [];
for (const target of await targets()) {
  const row = await benchOne(target).catch((error: unknown) => {
    console.log(`${target.group}/${target.name} | FAILED ${String(error).slice(0, 120)}`);
    return null;
  });
  if (row) {
    rows.push(row);
    console.log(line(row));
  }
}
const outDir = '.data/p0/bench';
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `detection-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), rows }, null, 2));
console.log(`written ${out}`);
