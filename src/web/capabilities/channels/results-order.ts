import type { ShareResultsResponse } from '../../../contracts/sharing.js';

type QuestionResult = ShareResultsResponse['questions'][number];

/** The share of askings answered right; a question never asked counts as fully right. */
const rightRate = (q: QuestionResult) => (q.asked === 0 ? 1 : q.correct / q.asked);

/** Questions with the most missed first; ties put the most asked first. */
export const mostMissedFirst = (questions: readonly QuestionResult[]): QuestionResult[] =>
  [...questions].sort((a, b) => rightRate(a) - rightRate(b) || b.asked - a.asked);

/** A percent as a whole number with its sign, or a dash when there is none. */
export const percentText = (percent: number | null): string =>
  percent === null ? '—' : `${Math.round(percent)}%`;
