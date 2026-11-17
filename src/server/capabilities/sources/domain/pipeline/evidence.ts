// M34 P4b: D4.6, combining a question's answer evidence (curriculum level 4) by code. One positive
// signal is the answer; disagreeing signals, or a positive the vision lesson struck out, go to
// review; no signal stays undecided. Nothing is ever guessed.
import { markLesson } from './lessons/mark.js';
import type { PipelineEvidence, PipelineQuestion } from './question.js';

/** The vision lesson's reading of one question, in positional letters. */
export interface VisionMark {
  letter: string | null;
  eliminated: readonly string[];
}

/** The lesson's reply, `review` when no approved model passed its check, or null when not asked. */
export type VisionVerdict = { mark: VisionMark } | 'review' | null;

/** Set by the reader when the printed key itself shows doubt ("D?"): never taken as the answer. */
export const KEY_DOUBT = 'key_doubt';
export const NO_ANSWER = 'no_answer';
export const ANSWER_CONFLICT = 'answer_conflict';
export const MARK_UNCLEAR = markLesson.reviewReason;

interface Positive {
  kind: PipelineEvidence;
  letters: readonly string[];
}

/** The signals the reader already found: they all decided `answers` together. */
const RULE_SIGNALS = new Set<PipelineEvidence>([
  'printed_key',
  'pen_mark',
  'single_option',
  'explanation_text',
]);

function positivesOf(question: PipelineQuestion, vision: VisionVerdict): Positive[] {
  const positives: Positive[] = question.evidence
    .filter((kind) => RULE_SIGNALS.has(kind) && kind !== 'single_option')
    .map((kind) => ({ kind, letters: question.answers }))
    .filter((positive) => positive.letters.length > 0);
  const [only] = question.options;
  if (question.options.length === 1 && only)
    positives.push({ kind: 'single_option', letters: [only.letter] });
  if (vision !== null && vision !== 'review' && vision.mark.letter !== null)
    positives.push({ kind: 'vision_mark', letters: [vision.mark.letter] });
  return positives;
}

const within = (small: readonly string[], large: readonly string[]) =>
  small.every((letter) => large.includes(letter));

/** Two signals agree when one names a part of the other (one mark on a two-letter key). */
const agree = (a: Positive, b: Positive) =>
  within(a.letters, b.letters) || within(b.letters, a.letters);

const named = (positive: Positive) => `${positive.kind}=${positive.letters.join('')}`;

function disagreements(positives: readonly Positive[], vision: VisionVerdict): string[] {
  const found: string[] = [];
  positives.forEach((a, index) => {
    for (const b of positives.slice(index + 1))
      if (!agree(a, b)) found.push(`${named(a)} disagrees with ${named(b)}`);
  });
  const crossed = vision !== null && vision !== 'review' ? vision.mark.eliminated : [];
  for (const positive of positives) {
    const struck = positive.letters.filter((letter) => crossed.includes(letter));
    if (struck.length > 0) found.push(`${named(positive)} is struck out (${struck.join('')})`);
  }
  return found;
}

const unique = <T>(items: readonly T[]) => [...new Set(items)];

function undecided(question: PipelineQuestion, conflicts: string[], reasons: string[]) {
  return {
    ...question,
    answers: [],
    conflicts: unique(conflicts),
    reviewReasons: unique([...question.reviewReasons, ...reasons]),
  };
}

/**
 * The question with its answer decided from every signal. A printed key marked doubtful, an
 * earlier conflict, two different positives, or a positive struck out leave it without an
 * answer and in review; with no positive at all it waits for the solvers (`no_answer`).
 */
export function combineEvidence(
  question: PipelineQuestion,
  vision: VisionVerdict,
): PipelineQuestion {
  const positives = positivesOf(question, vision);
  const kinds = unique(positives.map((positive) => positive.kind));
  const conflicts = [...question.conflicts, ...disagreements(positives, vision)];
  const unclear = vision === 'review' ? [MARK_UNCLEAR] : [];
  if (question.reviewReasons.includes(KEY_DOUBT))
    return { ...undecided(question, conflicts, unclear), evidence: kinds };
  if (conflicts.length > 0)
    return { ...undecided(question, conflicts, [ANSWER_CONFLICT, ...unclear]), evidence: kinds };
  if (positives.length === 0)
    return { ...undecided(question, [], [NO_ANSWER, ...unclear]), evidence: ['none'] };
  const widest = positives.reduce((a, b) => (b.letters.length > a.letters.length ? b : a));
  return { ...question, answers: [...widest.letters], evidence: kinds };
}
