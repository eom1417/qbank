import { eligibilityOf, type AnswerProvenance } from './imported.js';

/** How much a review reason risks a wrong study answer (FR-09-001: science before form). */
export type Severity = 'high' | 'medium' | 'low';

/** A wrong or missing answer, or text that may say something else, comes first. */
const HIGH: ReadonlySet<string> = new Set([
  'no_answer',
  'key_conflict',
  'explanation_conflict',
  'ai_disagrees',
  'empty_stem',
  'too_few_options',
  'duplicate_options',
  'garbled_text',
  'reported',
  'reimport_differs',
]);
/** A picture or a page that may be missing from the question. */
const MEDIUM: ReadonlySet<string> = new Set([
  'media_not_kept',
  'media_uncertain',
  'unreadable_page',
  'numbering_gap',
  'duplicate',
]);
const RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

function severityOf(reason: string): Severity {
  if (HIGH.has(reason)) return 'high';
  return MEDIUM.has(reason) ? 'medium' : 'low';
}

/** A question's severity is its worst reason's; one with no reason is low. */
export function questionSeverity(reasons: readonly string[]): Severity {
  return reasons.reduce<Severity>((worst, reason) => {
    const severity = severityOf(reason);
    return RANK[severity] > RANK[worst] ? severity : worst;
  }, 'low');
}

export const severityRank = (severity: Severity): number => RANK[severity];

interface ReviewedQuestion {
  kind: 'mcq' | 'essay';
  options: readonly { letter: string; text: string }[];
  answer_letters: readonly string[];
  answer_provenance: AnswerProvenance;
  review_reasons: readonly string[];
  ai_answer_accepted_at: Date | null;
}

/** Complete enough to study: an MCQ with two filled options, a stem, and its answers among them. */
function isComplete(question: ReviewedQuestion & { stem: string }): boolean {
  const letters = new Set(question.options.map((option) => option.letter));
  return (
    question.kind === 'mcq' &&
    question.stem.trim() !== '' &&
    question.options.filter((option) => option.text.trim() !== '').length >= 2 &&
    question.answer_letters.length > 0 &&
    question.answer_letters.every((letter) => letters.has(letter))
  );
}

/**
 * The owner's approval (FR-09-004): a complete question becomes eligible and its reasons are
 * settled. An AI-suggested answer is accepted with its permanent badge (DEC-03). Null when it
 * cannot be studied yet (no answer, an essay, a broken option list).
 */
export function approvalOf(question: ReviewedQuestion & { stem: string }, now: Date) {
  if (!isComplete(question)) return null;
  const aiAccepted =
    question.answer_provenance === 'ai_suggested' ? (question.ai_answer_accepted_at ?? now) : null;
  const provenance: AnswerProvenance =
    question.answer_provenance === 'conflict' || question.answer_provenance === 'missing'
      ? 'manual'
      : question.answer_provenance;
  return {
    review_reasons: [],
    answer_provenance: provenance,
    ai_answer_accepted_at: aiAccepted,
    deferred_at: null,
    status: eligibilityOf({
      kind: question.kind,
      answers: question.answer_letters,
      provenance,
      reasons: [],
      aiAccepted: aiAccepted !== null,
    }),
  };
}

/** Reasons a bulk approval may settle: they never change what the right answer is. */
const SAFE_IN_BULK: ReadonlySet<string> = new Set(['ocr_page', 'media_low_quality']);

/**
 * Safe bulk approval (FR-09-006): only complete questions whose answer comes from the source or
 * the owner, with nothing but harmless notes. Conflicts, missing parts and AI answers stay.
 */
export function isSafeToApproveInBulk(question: ReviewedQuestion & { stem: string }): boolean {
  const trusted =
    question.answer_provenance === 'source' || question.answer_provenance === 'manual';
  return (
    trusted &&
    isComplete(question) &&
    question.review_reasons.every((reason) => SAFE_IN_BULK.has(reason))
  );
}
