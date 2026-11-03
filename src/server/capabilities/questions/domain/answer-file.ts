import { eligibilityOf, type AnswerProvenance } from './imported.js';

/** A saved question as an answer file sees it. */
export interface KeyedRow {
  kind: 'mcq' | 'essay';
  options: unknown;
  answer_letters: string[];
  answer_provenance: AnswerProvenance;
  answer_evidence: string | null;
  review_reasons: string[];
  status: string;
  ai_answer_accepted_at: Date | null;
}

const ANSWER_REASONS = new Set(['no_answer', 'ai_suggested', 'key_conflict']);

/** The file's letters the question has, and whether they disagree with what is there. */
function checkLetters(row: KeyedRow, letters: readonly string[]) {
  const options = (row.options as { letter: string }[]).map((option) => option.letter);
  const valid = letters.filter((letter) => options.includes(letter));
  const penDiffers =
    row.answer_evidence === 'pen_mark' && !row.answer_letters.every((l) => valid.includes(l));
  return { valid, conflict: valid.length !== letters.length || valid.length === 0 || penDiffers };
}

/**
 * A question after its separate answer file was matched (FR-07-002, UAT-013): the file's key
 * becomes the source answer; a pen mark that says otherwise, or a letter the question does not
 * have, is a conflict for review. The user's own answer is never overwritten.
 */
export function withAnswerFile(row: KeyedRow, letters: readonly string[]) {
  if (row.answer_provenance === 'manual' || row.kind === 'essay') return null;
  const { valid, conflict } = checkLetters(row, letters);
  const reasons = [
    ...row.review_reasons.filter((reason) => !ANSWER_REASONS.has(reason)),
    ...(conflict ? ['key_conflict'] : []),
  ];
  const provenance: AnswerProvenance = conflict ? 'conflict' : 'source';
  const answers = valid.length > 0 ? valid : row.answer_letters;
  const status =
    row.status === 'excluded'
      ? 'excluded'
      : eligibilityOf({ kind: row.kind, answers, provenance, reasons, aiAccepted: false });
  return {
    answer_letter: answers[0] ?? null,
    answer_letters: answers,
    answer_provenance: provenance,
    answer_evidence: 'answer_file',
    review_reasons: reasons,
    status,
  };
}
