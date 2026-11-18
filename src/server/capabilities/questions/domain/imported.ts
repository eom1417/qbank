/** How the answer key was found; the order of trust is source > manual > ai_suggested. */
export type AnswerProvenance =
  'source' | 'manual' | 'ai_suggested' | 'ai_verified' | 'conflict' | 'missing';

/** Why a question needs a person's decision before it can be studied (FR-06, M7 review). */
export type ReviewReason =
  | 'no_answer'
  | 'ai_suggested'
  | 'ai_disagrees'
  | 'ocr_page'
  | 'unreadable_page'
  | 'numbering_gap'
  | 'empty_stem'
  | 'essay'
  | 'media_uncertain'
  | 'media_low_quality'
  | 'media_not_kept'
  | 'key_conflict'
  | 'explanation_conflict'
  | 'duplicate_options'
  | 'too_few_options'
  | 'garbled_text'
  /** Read from the page image by the user's AI: its text is checked by the owner. */
  | 'ai_read'
  /** M34 pipeline: only one option was printed (Q32); it never enters an exam unchecked. */
  | 'single_option'
  /** M34 pipeline: the file says the answer is none of the options (Q54). */
  | 'none_of_options'
  /** M34 pipeline: the printed key itself shows doubt ("D?"). */
  | 'key_doubt'
  /** M34 pipeline: two answer signals disagree, or a positive one is struck out (Q31). */
  | 'answer_conflict'
  /** M34 pipeline: the vision lesson could not read the marked option. */
  | 'mark_unclear'
  /** M34 pipeline: a picture of the question's words could not be read. */
  | 'picture_unreadable'
  /** M34 safety (Q85): the answer rests on one signal only; a second must confirm it. */
  | 'single_signal'
  /** M34 safety (Q85): where a picture belongs is not certain; it is hidden until the reveal. */
  | 'picture_place_unsure'
  /** M36 (Q106): text shaped like a question was left unread after it; one may be missing. */
  | 'unread_question_text'
  /** M39: the detection's own check is not sure of this question; its parts need a look. */
  | 'detection_doubt';

/** A question's text and answer, as a write sets them (restoring, the AI triage). */
export interface QuestionContent {
  kind: 'mcq' | 'essay';
  stem: string;
  options: { letter: string; label: string; text: string }[];
  answers: string[];
  provenance: AnswerProvenance;
  evidence: string | null;
}

/** One question as an import produced it, before it is saved. */
export interface ImportedQuestion {
  number: number;
  page: number;
  kind: 'mcq' | 'essay';
  stem: string;
  options: { letter: string; label: string; text: string }[];
  answer: string | null;
  /** Every right option; several for a multiple-select question (FR-07-008). */
  answers: string[];
  multiSelect: boolean;
  provenance: AnswerProvenance;
  /** `answer_key`, `answer_file`, `explanation`, `pen_mark`, `single_option`, `ai_suggested`. */
  evidence: string | null;
  /** The author's explanation as printed, never mixed with generated text (FR-07-009). */
  explanation: string | null;
  reasons: ReviewReason[];
}

/**
 * Which occurrence of its number each question is on its page (1, 2…): numbering restarts per
 * chapter, so page and number alone do not identify a question.
 */
export function occurrencesOf(questions: readonly { page: number; number: number }[]): number[] {
  const seen = new Map<string, number>();
  return questions.map((question) => {
    const key = `${question.page}:${question.number}`;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    return occurrence;
  });
}

/** Where a picture is shown (M34): with the question, an option, its case, or after the reveal. */
export type MediaPlacement = 'question' | 'option' | 'explanation' | 'case';

/** A figure or table kept for a question, already stored as a blob (M5). */
export interface ImportedMedia {
  /** The question it belongs to, by its place in the source. */
  questionPage: number;
  questionNumber: number;
  questionOccurrence: number;
  /** Order among the question's pictures (FR-06-003). */
  position: number;
  page: number;
  box: { x0: number; y0: number; x1: number; y1: number };
  kind: 'figure' | 'table';
  modality: string | null;
  certain: boolean;
  blobKey: string;
  width: number;
  height: number;
  quality: { sharpness: number; contrast: number; ppi: number | null; low: boolean };
  /** Null for the rules' pictures (shown as before, Q65); set by the M34 pipeline. */
  placement: MediaPlacement | null;
  /** The option's letter when `placement` is `option`, else null. */
  optionLetter: string | null;
}

/**
 * Reasons that only inform; every other reason holds the question for review. How a page was
 * read, a skipped number or a doubtful picture never makes an answer wrong (DEC-33).
 */
const INFORMATIONAL: ReadonlySet<string> = new Set([
  'essay',
  // Read by the user's AI as printed (DEC-34): organizing changes no content.
  'ai_read',
  'ocr_page',
  'numbering_gap',
  'media_low_quality',
  'media_uncertain',
]);

/** Whether a reason holds a question for review. */
const holdsForReview = (reason: string) => !INFORMATIONAL.has(reason);

/** Where a question stands (FR-11-001): only `eligible` questions are studied. */
export type Eligibility = 'detected' | 'needs_review' | 'eligible' | 'excluded';

export interface EligibilityInputs {
  kind: 'mcq' | 'essay';
  answers: readonly string[];
  provenance: AnswerProvenance;
  reasons: readonly string[];
  /** The user accepted the AI's suggested answer (DEC-03); its badge stays. */
  aiAccepted: boolean;
}

/**
 * Eligible only with an answer the source gives (or the user set, or the user accepted from
 * their AI, or the triage verified, DEC-33) and nothing left to review (FR-11-002, FR-07-003). Essays stay detected: they have
 * no key to study with yet. Exclusion is the user's decision only (M7).
 */
export function eligibilityOf(question: EligibilityInputs): Eligibility {
  if (question.reasons.some(holdsForReview)) return 'needs_review';
  if (question.kind === 'essay') return 'detected';
  if (question.answers.length === 0) return 'needs_review';
  const trusted =
    question.provenance === 'source' ||
    question.provenance === 'manual' ||
    question.provenance === 'ai_verified' ||
    (question.provenance === 'ai_suggested' && question.aiAccepted);
  return trusted ? 'eligible' : 'needs_review';
}
