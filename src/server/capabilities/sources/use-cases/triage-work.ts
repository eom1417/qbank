import type { QuestionRow } from '../../questions/index.js';
import type { TriageQuestion } from '../domain/triage/batch.js';
import type { Reshaped } from '../domain/triage/reshape.js';

export type Option = { letter: string; label: string; text: string };

/** Questions whose status follows the rules (an excluded or archived one is the owner's call). */
export const isOpen = (row: QuestionRow) =>
  row.status === 'needs_review' || row.status === 'eligible' || row.status === 'detected';

/** Questions the AI may change: not the owner's own decisions, not multiple-select. */
export const triageable = (row: QuestionRow) =>
  isOpen(row) &&
  row.answer_provenance !== 'manual' &&
  row.owner_edited_at === null &&
  !row.multi_select;

/**
 * Answers that vote like the file's: printed or marked, read by the AI, verified before, or the
 * file's answer an earlier triage disputed.
 */
const PRIOR: ReadonlySet<string> = new Set(['source', 'ai_suggested', 'ai_verified', 'conflict']);

/** The answer the question already has, if any: overturned only as the file's would be. */
export const fileAnswerOf = (row: QuestionRow) =>
  PRIOR.has(row.answer_provenance) ? row.answer_letter : null;

/** One question on its way through the AI: its saved row, as asked, and as improved. */
export interface Work {
  row: QuestionRow;
  question: TriageQuestion;
  improved: Reshaped | null;
}

export interface Shown {
  stem: string;
  options: Option[];
  /** The file's answer in the shown letters: its own, or the one its text gave (a scan). */
  file: string | null;
  printed: boolean;
}

/**
 * The options as printed: when nothing was added (the order stays), each original option keeps
 * the label the page printed (أ, ب, a.); new or reordered options are labelled by their letter.
 */
function printedLabels(improved: Reshaped, original: readonly Option[]): Option[] {
  if (improved.added.size > 0) return improved.options;
  const labels = new Map(
    [...improved.moved].map(([from, now]) => [now, original.find((o) => o.letter === from)?.label]),
  );
  return improved.options.map((o) => ({ ...o, label: labels.get(o.letter) ?? o.label }));
}

/** The question as the models see it: improved when the organizer's reply was accepted. */
export function shown(work: Work): Shown {
  const file = fileAnswerOf(work.row);
  const options = work.row.options as Option[];
  if (!work.improved) return { stem: work.row.stem, options, file, printed: false };
  const moved = file ? (work.improved.moved.get(file) ?? null) : null;
  const printed = moved === null ? work.improved.printed : null;
  return {
    stem: work.improved.stem,
    options: printedLabels(work.improved, options),
    file: moved ?? printed,
    printed: printed !== null,
  };
}

export const asTriage = (
  id: string,
  view: { stem: string; options: Option[] },
): TriageQuestion => ({
  id,
  stem: view.stem,
  options: view.options.map(({ letter, text }) => ({ letter, text })),
});

/** The questions the AI may work on, each with its id in the batch ("q1", "q2"…). */
export const worksOf = (rows: readonly QuestionRow[]): Work[] =>
  rows.filter(triageable).map((row, index) => ({
    row,
    question: asTriage(`q${index + 1}`, { stem: row.stem, options: row.options as Option[] }),
    improved: null,
  }));
