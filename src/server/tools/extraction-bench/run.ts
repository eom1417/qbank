import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AiProvider } from '../../capabilities/providers/index.js';
import {
  extractQuestions,
  suggestMarks,
  type ExtractedQuestion,
  type ReadingMode,
} from '../../capabilities/sources/index.js';
import { scoreExtraction, type ReferenceQuestion, type Score } from './score.js';
import { failures } from './thresholds.js';

export interface SampleResult {
  sample: string;
  /** `text`, `ocr`, or either with `+ai` (AI mark suggestions on top of the rules). */
  mode: string;
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

interface RunInput {
  file: string;
  mode: ReadingMode;
  ai: AiProvider | null;
}

async function extract({ file, mode, ai }: RunInput) {
  const started = Date.now();
  const rules = await extractQuestions(file, mode);
  const extracted = ai ? await suggestMarks(file, rules, ai) : rules;
  return { extracted, seconds: (Date.now() - started) / 1000 };
}

/**
 * Extracts one sample in each mode and scores it; OCR stems are compared to the text layer.
 * With the user's own `ai` provider, each mode is run again with AI mark suggestions on top.
 */
export async function benchSample(
  dir: string,
  sample: string,
  modes: readonly ReadingMode[],
  ai: AiProvider | null = null,
) {
  const reference = JSON.parse(
    readFileSync(join(dir, `${sample}.answers.json`), 'utf8'),
  ) as ReferenceQuestion[];
  const file = join(dir, `${sample}.pdf`);
  const results: SampleResult[] = [];
  let textLayer: ExtractedQuestion[] | null = null;
  const runs = modes.flatMap((mode) =>
    ai
      ? [
          { mode, ai: null },
          { mode, ai },
        ]
      : [{ mode, ai: null }],
  );
  for (const run of runs) {
    const { extracted, seconds } = await extract({ file, ...run });
    if (run.mode === 'text' && !run.ai) textLayer = extracted;
    const score = scoreExtraction(reference, extracted, run.mode === 'text' ? null : textLayer);
    const label = run.ai ? `${run.mode}+ai` : run.mode;
    results.push({ sample, mode: label, score, failures: failures(run.mode, score), seconds });
  }
  return results;
}
