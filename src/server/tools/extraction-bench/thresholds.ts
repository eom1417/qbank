import type { ReadingMode } from '../../capabilities/sources/index.js';
import type { Score } from './score.js';

/**
 * Acceptance ratios per reading mode (DEC-21, proposed until the owner signs them off).
 * Wrong answer keys are the costly failure, so they get the tightest limit; an undecided
 * answer is acceptable because it goes to review instead of becoming a wrong key.
 */
const THRESHOLDS: Record<ReadingMode, Record<string, number>> = {
  text: {
    questionsFound: 0.98,
    pagesCorrect: 0.98,
    optionsCorrect: 0.95,
    answersCovered: 0.85,
    answersWrongMax: 0.02,
  },
  // Floors from the first measurement of OCR on rendered pages (a simulated scan), kept a little
  // under the measured values so any regression fails; real scans will set the product target.
  ocr: {
    questionsFound: 0.95,
    pagesCorrect: 0.95,
    optionsCorrect: 0.65,
    answersCovered: 0.45,
    answersWrongMax: 0.05,
    stemSimilarity: 0.93,
  },
};

const ratio = (part: number, whole: number) => (whole === 0 ? 1 : part / whole);

/** The measured ratios, named like the thresholds. */
export function ratios(score: Score): Record<string, number> {
  const decided = score.answerCorrect + score.answerWrong;
  return {
    questionsFound: ratio(score.found, score.questions),
    pagesCorrect: ratio(score.pageCorrect, score.questions),
    optionsCorrect: ratio(score.optionsCorrect, score.questions),
    answersCovered: ratio(score.answerCorrect, score.decidable),
    answersWrongMax: decided === 0 ? 0 : score.answerWrong / decided,
    stemSimilarity: score.stemSimilarity ?? 1,
  };
}

/** Names of the ratios that miss their threshold (a "Max" ratio must stay at or below it). */
export function failures(mode: ReadingMode, score: Score): string[] {
  const measured = ratios(score);
  return Object.entries(THRESHOLDS[mode]).flatMap(([name, limit]) => {
    const value = measured[name] ?? 0;
    const ok = name.endsWith('Max') ? value <= limit : value >= limit;
    return ok ? [] : [`${name} ${value.toFixed(3)} vs ${limit}`];
  });
}
