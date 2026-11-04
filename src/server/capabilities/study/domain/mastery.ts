/**
 * The mastery and review policy (docs/policies/mastery.md, DEC-11 and DEC-12 assumed): the
 * same record always gives the same level and date, and each says why in plain terms.
 */

export interface Attempt {
  correct: boolean;
  at: Date;
  /** Time spent answering, when known (Tutor records it; exams do not per question). */
  seconds?: number | null;
}

export type Level = 'new' | 'weak' | 'learning' | 'good' | 'mastered';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days until the next look, by the number of right answers in a row (0 = last was wrong). */
const INTERVAL_DAYS = [1, 2, 4, 8, 16, 32];
const MASTERED_STREAK = 4;
const MASTERED_SPAN_DAYS = 7;

/** Right answers in a row up to the latest attempt (attempts oldest first). */
function streakOf(attempts: readonly Attempt[]): number {
  let streak = 0;
  for (let i = attempts.length - 1; i >= 0 && attempts[i]?.correct; i--) streak += 1;
  return streak;
}

function isWeak(attempts: readonly Attempt[]): boolean {
  return attempts.slice(-3).filter((a) => !a.correct).length >= 2;
}

/** The level (FR-15-002, FR-15-003): built on consistency, never on one answer. */
export function levelOf(attempts: readonly Attempt[]): Level {
  if (attempts.length === 0) return 'new';
  if (isWeak(attempts)) return 'weak';
  const streak = streakOf(attempts);
  if (streak <= 1) return 'learning';
  if (streak < MASTERED_STREAK) return 'good';
  const run = attempts.slice(-streak);
  const span = (run.at(-1)?.at.getTime() ?? 0) - (run[0]?.at.getTime() ?? 0);
  return span >= MASTERED_SPAN_DAYS * DAY_MS ? 'mastered' : 'good';
}

export const intervalDays = (streak: number) =>
  INTERVAL_DAYS[Math.min(streak, INTERVAL_DAYS.length - 1)] ?? 1;

/** When the question is due again (FR-15-004); null for a question never answered. */
export function nextDue(attempts: readonly Attempt[]): Date | null {
  const last = attempts.at(-1);
  if (!last) return null;
  return new Date(last.at.getTime() + intervalDays(streakOf(attempts)) * DAY_MS);
}

/** How much one question is mastered, 0 to 1: a single right answer is a quarter (FR-15-003). */
export const masteryScore = (attempts: readonly Attempt[]) =>
  Math.min(streakOf(attempts), MASTERED_STREAK) / MASTERED_STREAK;

/** Everything study needs to know about one question's record. */
export interface QuestionState {
  level: Level;
  streak: number;
  attempts: number;
  lastCorrect: boolean | null;
  due: Date | null;
  isDue: boolean;
}

export function stateOf(attempts: readonly Attempt[], now: Date): QuestionState {
  const due = nextDue(attempts);
  return {
    level: levelOf(attempts),
    streak: streakOf(attempts),
    attempts: attempts.length,
    lastCorrect: attempts.at(-1)?.correct ?? null,
    due,
    isDue: due !== null && due.getTime() <= now.getTime(),
  };
}
