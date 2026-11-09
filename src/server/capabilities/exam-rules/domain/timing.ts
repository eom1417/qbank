/** An exam's timing as announced before it started (FR-13-002…004). */
export interface ExamTiming {
  timing: 'none' | 'total' | 'per_question';
  timing_seconds: number | null;
  deadline_at: Date | null;
  status: 'active' | 'finished';
}

/** The deadline of a total-time exam, set when the owner presses start (FR-13-005, UAT-049). */
export function deadlineFor(
  timing: 'none' | 'total' | 'per_question',
  seconds: number | null,
  startedAt: Date,
) {
  return timing === 'total' && seconds ? new Date(startedAt.getTime() + seconds * 1000) : null;
}

/** The total time is over: the exam is submitted as it stands (DEC-06 assumed, FR-13-011). */
export const isOverdue = (exam: ExamTiming, now: Date) =>
  exam.status === 'active' &&
  exam.deadline_at !== null &&
  now.getTime() >= exam.deadline_at.getTime();

/** Seconds left of the whole exam, or of the open question; null when untimed. */
export function secondsLeft(exam: ExamTiming, openedAt: Date | null, now: Date): number | null {
  if (exam.timing === 'total' && exam.deadline_at)
    return Math.max(0, Math.ceil((exam.deadline_at.getTime() - now.getTime()) / 1000));
  if (exam.timing === 'per_question' && exam.timing_seconds && openedAt)
    return Math.max(
      0,
      exam.timing_seconds - Math.floor((now.getTime() - openedAt.getTime()) / 1000),
    );
  return null;
}

/**
 * Whether the owner may still change this item's answer (FR-13-004, DEC-07 assumed): per-question
 * timing locks a question once its time is used, and earlier questions cannot be reopened.
 */
export function canChange(
  exam: ExamTiming,
  item: { position: number; opened_at: Date | null },
  current: number,
  now: Date,
) {
  if (exam.status !== 'active' || isOverdue(exam, now)) return false;
  if (exam.timing !== 'per_question') return true;
  if (item.position < current) return false;
  return item.opened_at === null || (secondsLeft(exam, item.opened_at, now) ?? 1) > 0;
}
