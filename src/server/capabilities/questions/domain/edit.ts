import type { EditQuestionRequest } from '../../../../contracts/questions.js';
import { eligibilityOf, type AnswerProvenance } from './imported.js';

interface Option {
  letter: string;
  label: string;
  text: string;
}

interface EditedRow {
  kind: 'mcq' | 'essay';
  stem: string;
  options: Option[];
  answer_letters: string[];
  answer_provenance: AnswerProvenance;
  answer_evidence: string | null;
  review_reasons: string[];
  status: string;
  ai_answer_accepted_at: Date | null;
}

/** Reasons the owner settles by choosing the answer themselves. */
const ANSWER_REASONS: ReadonlySet<string> = new Set([
  'no_answer',
  'key_conflict',
  'ai_suggested',
  'ai_disagrees',
]);

/** New options keep the printed label of a letter they already had. */
function optionsOf(row: EditedRow, edited: NonNullable<EditQuestionRequest['options']>): Option[] {
  const labels = new Map(row.options.map((option) => [option.letter, option.label]));
  return edited.map((o) => ({
    letter: o.letter,
    label: labels.get(o.letter) ?? o.letter,
    text: o.text,
  }));
}

/** Choosing the answer makes it the owner's own (provenance `manual`); unchanged keeps it. */
function answerChanges(row: EditedRow, answers: string[] | undefined) {
  if (answers === undefined || answers.join() === row.answer_letters.join()) return null;
  const sorted = [...answers].sort();
  return {
    answer_letters: sorted,
    answer_letter: sorted[0] ?? null,
    multi_select: sorted.length > 1,
    answer_provenance: (sorted.length > 0 ? 'manual' : 'missing') as AnswerProvenance,
    answer_evidence: null,
    ai_answer_accepted_at: null,
  };
}

/** What an edit leaves to review: missing parts are named again, never silently eligible. */
function reasonsAfter(
  reasons: readonly string[],
  stem: string,
  options: Option[],
  answers: string[],
) {
  const letters = new Set(options.map((option) => option.letter));
  const next = new Set(reasons);
  if (stem.trim() === '') next.add('empty_stem');
  if (options.filter((option) => option.text.trim() !== '').length < 2) next.add('too_few_options');
  if (answers.length === 0 || !answers.every((letter) => letters.has(letter)))
    next.add('no_answer');
  return [...next];
}

/** Excluded stays excluded; otherwise the usual eligibility (FR-11-002). */
function statusAfter(
  row: EditedRow,
  answers: string[],
  provenance: AnswerProvenance,
  reasons: string[],
  accepted: boolean,
) {
  if (row.status === 'excluded') return 'excluded';
  return eligibilityOf({ kind: row.kind, answers, provenance, reasons, aiAccepted: accepted });
}

/** The free-text fields the edit sends; the rest stay as they are. */
const textChanges = (edit: EditQuestionRequest) => ({
  ...(edit.explanation !== undefined ? { explanation: edit.explanation } : {}),
  ...(edit.updateNote !== undefined ? { update_note: edit.updateNote } : {}),
});

/**
 * The changes an edit makes (FR-09-003): only the fields sent, with the answer and its
 * provenance kept honest. An eligible question stays eligible unless the edit made it
 * incomplete; an excluded one stays excluded.
 */
export function editChanges(row: EditedRow, edit: EditQuestionRequest) {
  const stem = edit.stem ?? row.stem;
  const options = edit.options ? optionsOf(row, edit.options) : row.options;
  const answer = answerChanges(row, edit.answers);
  const answers = answer?.answer_letters ?? row.answer_letters;
  const settled = answer
    ? row.review_reasons.filter((r) => !ANSWER_REASONS.has(r))
    : row.review_reasons;
  const reasons = reasonsAfter(settled, stem, options, answers);
  const provenance = answer?.answer_provenance ?? row.answer_provenance;
  const accepted = !answer && row.ai_answer_accepted_at !== null;
  return {
    stem,
    options: JSON.stringify(options),
    ...(answer ?? {}),
    review_reasons: reasons,
    status: statusAfter(row, answers, provenance, reasons, accepted),
    ...textChanges(edit),
  };
}
