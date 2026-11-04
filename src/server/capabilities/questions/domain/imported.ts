/** How the answer key was found; the order of trust is source > manual > ai_suggested. */
export type AnswerProvenance = 'source' | 'manual' | 'ai_suggested' | 'conflict' | 'missing';

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
  | 'ai_read';

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
}

/** Reasons that only inform; every other reason holds the question for review. */
const INFORMATIONAL: ReadonlySet<string> = new Set(['essay']);

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
 * their AI) and nothing left to review (FR-11-002, FR-07-003). Essays stay detected: they have
 * no key to study with yet. Exclusion is the user's decision only (M7).
 */
export function eligibilityOf(question: EligibilityInputs): Eligibility {
  if (question.reasons.some((reason) => !INFORMATIONAL.has(reason))) return 'needs_review';
  if (question.kind === 'essay') return 'detected';
  if (question.answers.length === 0) return 'needs_review';
  const trusted =
    question.provenance === 'source' ||
    question.provenance === 'manual' ||
    (question.provenance === 'ai_suggested' && question.aiAccepted);
  return trusted ? 'eligible' : 'needs_review';
}
