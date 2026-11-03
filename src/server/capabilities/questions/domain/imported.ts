/** How the answer key was found; the order of trust is source > manual > ai_suggested. */
type AnswerProvenance = 'source' | 'manual' | 'ai_suggested' | 'conflict' | 'missing';

/** Why a question needs a person's decision before it can be studied (FR-06, M7 review). */
export type ReviewReason =
  | 'no_answer'
  | 'ai_suggested'
  | 'ai_disagrees'
  | 'ocr_page'
  | 'unreadable_page'
  | 'numbering_gap'
  | 'empty_stem'
  | 'essay';

/** One question as an import produced it, before it is saved. */
export interface ImportedQuestion {
  number: number;
  page: number;
  kind: 'mcq' | 'essay';
  stem: string;
  options: { letter: string; label: string; text: string }[];
  answer: string | null;
  provenance: AnswerProvenance;
  /** `pen_mark`, `single_option` or `ai_suggested`: the evidence behind the answer. */
  evidence: string | null;
  reasons: ReviewReason[];
}

/** Reasons that only inform; every other reason holds the question for review. */
const INFORMATIONAL: ReadonlySet<ReviewReason> = new Set(['essay']);

/** `needs_review` when any reason needs a decision; `detected` otherwise (approval is M7). */
export const statusOf = (question: ImportedQuestion): 'detected' | 'needs_review' =>
  question.reasons.some((reason) => !INFORMATIONAL.has(reason)) ? 'needs_review' : 'detected';
