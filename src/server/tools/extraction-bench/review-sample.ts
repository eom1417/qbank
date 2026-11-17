import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TruthFile, type TruthQuestion } from './truth.js';

// M34 P0 step 5: `node --import tsx …/review-sample.ts <truth.json> <pagesDir> <outDir> [size]`
// Draws a fixed random sample of questions (the same file always gives the same sample) and
// copies only their pages, so an independent reviewer sees nothing else.

/** A small seeded generator (mulberry32): the sample is reproducible from the file's hash. */
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleOrdinals(questions: readonly TruthQuestion[], size: number, seed: number) {
  const ordinals = questions.map((question) => question.ordinal);
  const random = generator(seed);
  for (let i = ordinals.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ordinals[i], ordinals[j]] = [ordinals[j] ?? 0, ordinals[i] ?? 0];
  }
  return ordinals.slice(0, size).sort((a, b) => a - b);
}

function pageFile(dir: string, page: number): string | null {
  const names = [`p-${page}`, `p-${String(page).padStart(2, '0')}`].map((n) => `${n}.png`);
  const found = names.find((name) => existsSync(join(dir, name)));
  return found ? join(dir, found) : null;
}

if (process.argv[1]?.endsWith('review-sample.ts')) {
  const [truthPath = '', pagesDir = '', outDir = '', size = '30'] = process.argv.slice(2);
  const truth = TruthFile.parse(JSON.parse(readFileSync(truthPath, 'utf8')));
  const seed = Number.parseInt(truth.sha256.slice(0, 8), 16);
  const chosen = new Set(sampleOrdinals(truth.questions, Number(size), seed));
  const questions = truth.questions.filter((question) => chosen.has(question.ordinal));
  const pages = new Set(questions.flatMap((q) => [...q.pages, ...q.images.map((i) => i.page)]));
  mkdirSync(outDir, { recursive: true });
  for (const page of pages) {
    const from = pageFile(pagesDir, page);
    if (from) copyFileSync(from, join(outDir, `page-${page}.png`));
  }
  writeFileSync(
    join(outDir, 'packet.json'),
    JSON.stringify({ file: truth.file, questions }, null, 2),
  );
  console.log(`${questions.length} questions on ${pages.size} pages → ${outDir}`);
}
