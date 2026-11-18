import type { DraftQuestion, FileLines } from '../contract.js';

/** What every per-question check reads: the file and the median option length of all questions. */
export interface CheckContext {
  file: FileLines;
  medianOption: number;
}

export const textOf = (file: FileLines, ids: number[]): string =>
  ids
    .map((id) => file.lines[id]?.text ?? '')
    .join(' ')
    .trim();

/** The question's own lines in the order a reader meets them. */
export function partsInOrder(q: DraftQuestion): number[] {
  const answer = q.answer && q.answer.from !== 'key_table' ? q.answer.lines : [];
  return [
    ...(q.labelLine === null ? [] : [q.labelLine]),
    ...q.stem,
    ...q.options.flatMap((option) => option.lines),
    ...answer,
    ...q.explanation,
  ];
}

/** Every line id the question owns, wherever it sits. */
export function allLines(q: DraftQuestion): number[] {
  return [...partsInOrder(q), ...q.caseLines, ...(q.answer?.lines ?? [])];
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
