import { eligibilityOf, type QuestionContent, type ReviewReason } from './imported.js';

/** What the AI triage (DEC-33) decided for one saved question. */
export interface TriageChange extends QuestionContent {
  /** The file's answer, when the AI overturned it (DEC-16). */
  fileAnswer: string | null;
  /** The deciding reason, shown with the answer. */
  aiNote: string | null;
  /** Whether the AI settled the answer (else a person decides). */
  settled: boolean;
  /** Whether improvement mode rewrote the text (DEC-04). */
  improved: boolean;
}

/** Doubts about the answer that a settled triage answers. */
const ANSWER_DOUBTS: ReadonlySet<ReviewReason> = new Set([
  'no_answer',
  'ai_suggested',
  'ai_disagrees',
  'key_conflict',
  'explanation_conflict',
  'ai_read',
  // The solvers settled it from the text alone: the picture the book limits left out was not needed.
  'media_not_kept',
]);

/** Doubts about the text that an improvement answers (checked again on the new text). */
const TEXT_DOUBTS: ReadonlySet<ReviewReason> = new Set([
  'garbled_text',
  'too_few_options',
  'empty_stem',
  // The improver read the text again against the page's words.
  'ai_read',
]);

/** A reason the triage answered: an answer doubt it settled, a text doubt it rewrote away. */
const answered = (reason: ReviewReason, change: TriageChange) =>
  (change.settled && ANSWER_DOUBTS.has(reason)) ||
  (change.improved && TEXT_DOUBTS.has(reason)) ||
  (reason === 'essay' && change.kind === 'mcq');

/** What still needs a person after the triage: an unsettled answer, too few options. */
function remaining(change: TriageChange): ReviewReason[] {
  const mcq = change.kind === 'mcq';
  if (change.improved && mcq && change.options.length < 2) return ['too_few_options'];
  if (change.settled) return [];
  if (change.answers.length > 0) return ['ai_disagrees'];
  return mcq ? ['no_answer'] : [];
}

/** The review reasons after the triage: what it answered goes, what remains is real. */
function reasonsAfterTriage(
  previous: readonly ReviewReason[],
  change: TriageChange,
): ReviewReason[] {
  const kept = previous.filter((reason) => !answered(reason, change));
  return [...new Set([...kept, ...remaining(change)])];
}

/** The row values for a triaged question; its status follows from the one eligibility rule. */
export function triagedValues(previous: readonly ReviewReason[], change: TriageChange) {
  const reasons = reasonsAfterTriage(previous, change);
  return {
    kind: change.kind,
    stem: change.stem,
    options: JSON.stringify(change.options),
    answer_letter: change.answers[0] ?? null,
    answer_letters: change.answers,
    answer_provenance: change.provenance,
    answer_evidence: change.evidence,
    file_answer: change.fileAnswer,
    ai_note: change.aiNote,
    review_reasons: reasons,
    status: eligibilityOf({ ...change, reasons, aiAccepted: false }),
  };
}

/** A saved question's status under today's rule, for a question the triage left as it was. */
export function statusNow(row: {
  kind: 'mcq' | 'essay';
  answer_letters: string[];
  answer_provenance: QuestionContent['provenance'];
  review_reasons: string[];
  ai_answer_accepted_at: Date | null;
}) {
  return eligibilityOf({
    kind: row.kind,
    answers: row.answer_letters,
    provenance: row.answer_provenance,
    reasons: row.review_reasons,
    aiAccepted: row.ai_answer_accepted_at !== null,
  });
}
