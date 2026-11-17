import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildUnits, type FileUnits } from '../../capabilities/sources/adapters/pipeline-units.js';

// M34 P2 corpus check: `node --import tsx src/server/tools/extraction-bench/units-report.ts
// [truthDir] [corpusDir]`. Builds units for every file a truth file names and prints numbers
// only (no text, no images): pages, units by kind, images by class, filler, family, seconds.
// Run with OMP_THREAD_LIMIT=1: Tesseract's OpenMP threads spin against each other when several
// images are read at once on a busy machine (measured: 77 s instead of 2 s on the fixtures).
const [truthDir = '.data/truth', corpusDir = '.data/corpus'] = process.argv.slice(2);

const files = readdirSync(truthDir)
  .filter((name) => name.endsWith('.truth.json'))
  .map((name) => ({
    name: name.replace(/\.truth\.json$/, ''),
    file: (JSON.parse(readFileSync(join(truthDir, name), 'utf8')) as { file: string }).file,
  }));

const tally = (values: readonly string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([key, count]) => `${key}=${count}`).join(' ');
};

function report(name: string, result: FileUnits, seconds: number): string {
  const units = result.pages.flatMap((page) => page.units);
  const images = units.filter((unit) => unit.kind === 'image');
  const unsure = images.filter((unit) => unit.imageClass === 'unsure').length;
  const empty = result.pages.filter((page) => page.units.length === 0).length;
  const pages = result.pages.length;
  return [
    name,
    `pages=${pages} scanned=${result.pages.filter((page) => page.scanned).length}`,
    `empty_pages=${empty}`,
    `units: ${tally(units.map((unit) => unit.kind))}`,
    `images: ${tally(images.map((unit) => unit.imageClass ?? 'none'))}`,
    `filler: ${tally(units.flatMap((unit) => (unit.filler ? [unit.filler] : [])))}`,
    `unsure=${images.length > 0 ? ((unsure / images.length) * 100).toFixed(1) : '0.0'}%`,
    `family=${result.family.family} lessons=${result.family.lessons.length}`,
    `seconds=${seconds.toFixed(1)} per_page=${(seconds / Math.max(1, pages)).toFixed(2)}`,
  ].join(' | ');
}

let failed = false;
for (const { name, file } of files) {
  const started = performance.now();
  try {
    const result = await buildUnits(join(corpusDir, file));
    console.log(report(name, result, (performance.now() - started) / 1000));
  } catch (error) {
    failed = true;
    console.log(
      `${name} | error: ${error instanceof Error ? (error.message.split('\n')[0] ?? error.name) : 'unknown'}`,
    );
  }
}
process.exitCode = failed ? 1 : 0;
