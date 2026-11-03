import { eligibilityOf, type AnswerProvenance } from './imported.js';

interface SuggestedRow {
  kind: 'mcq' | 'essay';
  answer_letters: string[];
  answer_provenance: AnswerProvenance;
  review_reasons: string[];
  status: string;
}

/**
 * The user takes the answer their AI suggested (FR-07-006, DEC-03 assumed: allowed, with a
 * permanent badge): provenance stays `ai_suggested`, only its review reason goes. Null when the
 * question has no AI answer to accept.
 */
export function acceptAiAnswer(row: SuggestedRow, now: Date) {
  if (row.answer_provenance !== 'ai_suggested' || row.answer_letters.length === 0) return null;
  const reasons = row.review_reasons.filter((reason) => reason !== 'ai_suggested');
  return {
    ai_answer_accepted_at: now,
    review_reasons: reasons,
    status:
      row.status === 'excluded'
        ? 'excluded'
        : eligibilityOf({
            kind: row.kind,
            answers: row.answer_letters,
            provenance: row.answer_provenance,
            reasons,
            aiAccepted: true,
          }),
  };
}
