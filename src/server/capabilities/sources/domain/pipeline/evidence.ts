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
/** Q85: an answer must rest on two agreeing signals before it may enter an exam. */
export const SINGLE_SIGNAL = 'single_signal';
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

/** An option text shorter than this ("Yes", "IV") is too common to count as named. */
const MIN_NAMED_LENGTH = 4;
/**
 * The option must open the explanation ("Ans: Option text …"): measured on the truth files,
 * options named deeper in it were distractors being discussed as often as the answer.
 */
const MAX_LEAD_WORDS = 3;

const normalized = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;

const wordsBefore = (text: string, at: number) =>
  text.slice(0, at).split(' ').filter(Boolean).length;

/**
 * The option whose full text opens the file's own explanation, when exactly one does (D4.6);
 * null when none or several do, or the options are too short to tell.
 */
export function optionNamedByExplanation(question: PipelineQuestion): string | null {
  if (!question.explanation || question.options.length < 2) return null;
  const explanation = normalized(question.explanation);
  const matches = question.options.filter((option) => {
    const text = normalized(option.text);
    const at = explanation.indexOf(text);
    return (
      text.trim().length >= MIN_NAMED_LENGTH &&
      at >= 0 &&
      wordsBefore(explanation, at) <= MAX_LEAD_WORDS
    );
  });
  return matches.length === 1 ? (matches[0]?.letter ?? null) : null;
}

function positivesOf(question: PipelineQuestion, vision: VisionVerdict): Positive[] {
  const positives: Positive[] = question.evidence
    .filter((kind) => RULE_SIGNALS.has(kind) && kind !== 'single_option')
    .map((kind) => ({ kind, letters: question.answers }))
    .filter((positive) => positive.letters.length > 0);
  const byText = optionNamedByExplanation(question);
  if (byText) positives.push({ kind: 'explanation_text', letters: [byText] });
  // Only where the reader trusts it: OCR or a picture may have lost the other options.
  const [only] = question.options;
  if (question.options.length === 1 && only && question.evidence.includes('single_option'))
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

/** The reasons this step decides are recomputed every time, never inherited. */
const OWN_REASONS = new Set([NO_ANSWER, ANSWER_CONFLICT, MARK_UNCLEAR, SINGLE_SIGNAL]);
const othersOf = (question: PipelineQuestion) =>
  question.reviewReasons.filter((reason) => !OWN_REASONS.has(reason));

function undecided(question: PipelineQuestion, conflicts: string[], reasons: string[]) {
  return {
    ...question,
    answers: [],
    conflicts: unique(conflicts),
    reviewReasons: unique([...othersOf(question), ...reasons]),
  };
}

export interface CombineOptions {
  /**
   * M38 (Q137): in a file nobody wrote on, the printed key is the book's own answer and decides
   * alone. Two signals stay required in annotated notes, where a key was once read off the
   * question next to it (M35).
   */
  printedKeySuffices?: boolean;
}

/**
 * The question with its answer decided from every signal. A printed key marked doubtful, an
 * earlier conflict, two different positives, or a positive struck out leave it without an
 * answer and in review; with no positive at all it waits for the solvers (`no_answer`).
 */
export function combineEvidence(
  question: PipelineQuestion,
  vision: VisionVerdict,
  options: CombineOptions = {},
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
  // Q85, M35: two different signals must agree. A printed key or a vision mark alone (also read
  // twice: both readings share the crop) keeps its answer as a suggestion, held for review.
  const keyDecides = options.printedKeySuffices === true && kinds.includes('printed_key');
  const single = kinds.length >= 2 || keyDecides ? [] : [SINGLE_SIGNAL];
  const reviewReasons = unique([...othersOf(question), ...single]);
  return { ...question, answers: [...widest.letters], evidence: kinds, reviewReasons };
}
