// M34 P5: what a pipeline question still needs before an exam (curriculum level 7, D7.1). The
// review reasons below hold it; a question with no answer at all is left to the M19 solvers
// (`no_answer`, from the screening), exactly as a rules import is.
import type { ReviewReason } from '../../../questions/index.js';
import type { AnswerEvidence } from '../answer-decision.js';
import { KEY_DOUBT, MARK_UNCLEAR, SINGLE_SIGNAL } from './evidence.js';
import { UNREAD_QUESTION_TEXT } from './build-questions.js';
import { PLACE_UNSURE } from './placement.js';
import type { PipelineEvidence, PipelineQuestion } from './question.js';

/** Upstream steps may name this themselves (D4.1 trap: «none of them», Q54). */
const NONE_OF_OPTIONS = 'none_of_options';

/** The signal recorded as the answer's evidence, the most trusted first. */
const EVIDENCE: readonly [PipelineEvidence, AnswerEvidence][] = [
  ['printed_key', 'answer_key'],
  ['pen_mark', 'pen_mark'],
  ['vision_mark', 'ai_mark'],
  ['explanation_text', 'explanation'],
  ['single_option', 'single_option'],
];

/** How the answer was found, in the saved question's terms; null when it has none. */
export function evidenceOf(question: PipelineQuestion): AnswerEvidence | null {
  if (question.answers.length === 0) return null;
  return EVIDENCE.find(([kind]) => question.evidence.includes(kind))?.[1] ?? null;
}

/** An answer line that names no option: "Answer: none of them" (not an option that says so). */
const NONE_ANSWER =
  /\b(?:answer|correct)\b[^.\n]{0,20}?\bnone of (?:them|these|those|the (?:above|options|choices|answers))\b/i;
const NONE_OPTION = /\bnone of\b/i;

/** The file says the answer is none of the printed options (Q54). */
function noneOfOptions(question: PipelineQuestion): boolean {
  if (question.reviewReasons.includes(NONE_OF_OPTIONS)) return true;
  if (question.options.some((option) => NONE_OPTION.test(option.text))) return false;
  return NONE_ANSWER.test(question.explanation ?? '');
}

/** Reasons a step names, passed on as the saved question's review reason. */
const PASSED_ON: readonly [string, ReviewReason][] = [
  [KEY_DOUBT, 'key_doubt'],
  [MARK_UNCLEAR, 'mark_unclear'],
  ['picture_unreadable', 'picture_unreadable'],
  [SINGLE_SIGNAL, 'single_signal'],
  [PLACE_UNSURE, 'picture_place_unsure'],
  [UNREAD_QUESTION_TEXT, 'unread_question_text'],
];

/**
 * The pipeline's own review reasons: one option (Q32), conflicting signals (Q31), a doubtful
 * key, an unreadable mark or picture, or an answer outside the options (Q54). No options at
 * all is an essay question, and no answer waits for the solvers; the screening names both.
 */
export function pipelineReasons(question: PipelineQuestion): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  const named = (reason: string) => question.reviewReasons.includes(reason);
  if (question.options.length === 1) reasons.push('single_option');
  if (question.conflicts.length > 0 || named('answer_conflict')) reasons.push('answer_conflict');
  reasons.push(...PASSED_ON.filter(([step]) => named(step)).map(([, reason]) => reason));
  if (noneOfOptions(question)) reasons.push('none_of_options');
  return reasons;
}
