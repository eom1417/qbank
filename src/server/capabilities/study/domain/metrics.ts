import type { Rate } from '../../../../contracts/analytics.js';

/**
 * The one definition of every rate shown anywhere (M12.1, FR-21-008): a count out of a whole,
 * rounded to whole percent, and no percent at all when the whole is zero.
 */
const rate = (part: number, whole: number): Rate => ({
  part,
  whole,
  percent: whole === 0 ? null : Math.round((part / whole) * 100),
});

/** Accuracy: right answers out of answered questions (FR-16-002, UAT-064). */
export const accuracy = (correct: number, answered: number) => rate(correct, answered);

/** Score: right answers out of every question of the session, unanswered included (DEC-08). */
export const score = (correct: number, total: number) => rate(correct, total);

/** Fewer answers than this in a period or topic and its figure is only indicative (UAT-065). */
export const SMALL_SAMPLE = 10;
