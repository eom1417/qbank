import { explanationClaim } from './key-lines.js';

/**
 * Where an answer came from in the source. `ai_read` (a printed key) and `ai_mark` (a hand mark)
 * were read from the page by the user's AI: still the file's answer (DEC-34).
 */
export type AnswerEvidence =
  | 'answer_key'
  | 'answer_file'
  | 'explanation'
  | 'pen_mark'
  | 'single_option'
  | 'ai_read'
  | 'ai_mark';

/** Disagreements that hold a question for review instead of picking a side (FR-07-005). */
export type AnswerConflict = 'key_conflict' | 'explanation_conflict';

export interface AnswerDecision {
  /** The right options' letters; several for a multiple-select question; empty when unknown. */
  answers: string[];
  evidence: AnswerEvidence | null;
  conflicts: AnswerConflict[];
}

export interface AnswerInputs {
  /** The options' letters, to drop key letters the question does not have. */
  letters: readonly string[];
  /** What the pen marks (or a lone option) say, before any key. */
  marked: { answer: string | null; evidence: 'pen_mark' | 'single_option' | null };
  key: readonly string[] | null;
  explanation: string | null;
}

/** The answer before the explanation is checked: the key, else the marks, else unknown. */
function firstAnswer({ letters, marked, key }: AnswerInputs): AnswerDecision {
  const keyed = key?.filter((letter) => letters.includes(letter)) ?? [];
  // A key letter the question does not have (E on four options) is itself a conflict.
  const conflicts: AnswerConflict[] = key && keyed.length !== key.length ? ['key_conflict'] : [];
  if (keyed.length === 0)
    return marked.answer
      ? { answers: [marked.answer], evidence: marked.evidence, conflicts }
      : { answers: [], evidence: null, conflicts };
  const penDiffers =
    marked.evidence === 'pen_mark' && marked.answer !== null && !keyed.includes(marked.answer);
  if (penDiffers) conflicts.push('key_conflict');
  return { answers: keyed, evidence: 'answer_key', conflicts };
}

/**
 * The source's own key wins (FR-07-001); a pen mark or the author's explanation that names
 * another option makes it a conflict for review (FR-07-005). With no key and no mark, the
 * explanation's stated answer is used; otherwise nothing is made up (FR-07-003).
 */
export function decideAnswer(inputs: AnswerInputs): AnswerDecision {
  const decision = firstAnswer(inputs);
  const claim = inputs.explanation ? explanationClaim(inputs.explanation) : null;
  if (!claim || !inputs.letters.includes(claim)) return dedupe(decision);
  if (decision.answers.length === 0)
    return { ...decision, answers: [claim], evidence: 'explanation' };
  if (!decision.answers.includes(claim)) decision.conflicts.push('explanation_conflict');
  return dedupe(decision);
}

const dedupe = (decision: AnswerDecision): AnswerDecision => ({
  ...decision,
  conflicts: [...new Set(decision.conflicts)],
});
