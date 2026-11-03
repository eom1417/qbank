import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractQuestions,
  type ExtractedQuestion,
  type ReadingMode,
} from '../../capabilities/sources/index.js';
import { scoreExtraction, type ReferenceQuestion, type Score } from './score.js';
import { failures } from './thresholds.js';

export interface SampleResult {
  sample: string;
  mode: ReadingMode;
  score: Score;
  failures: string[];
  seconds: number;
}

/** Samples are `<name>.pdf` next to `<name>.answers.json` (the hand-made answer key). */
export function listSamples(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.answers.json'))
    .map((file) => file.replace(/\.answers\.json$/, ''))
    .filter((name) => existsSync(join(dir, `${name}.pdf`)))
    .sort();
}

/** Extracts one sample in each mode and scores it; OCR stems are compared to the text layer. */
export async function benchSample(dir: string, sample: string, modes: readonly ReadingMode[]) {
  const reference = JSON.parse(
    readFileSync(join(dir, `${sample}.answers.json`), 'utf8'),
  ) as ReferenceQuestion[];
  const results: SampleResult[] = [];
  let textLayer: ExtractedQuestion[] | null = null;
  for (const mode of modes) {
    const started = Date.now();
    const extracted = await extractQuestions(join(dir, `${sample}.pdf`), mode);
    const seconds = (Date.now() - started) / 1000;
    if (mode === 'text') textLayer = extracted;
    const score = scoreExtraction(reference, extracted, mode === 'text' ? null : textLayer);
    results.push({ sample, mode, score, failures: failures(mode, score), seconds });
  }
  return results;
}
