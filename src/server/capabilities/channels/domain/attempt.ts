import { createHash, timingSafeEqual } from 'node:crypto';
import type { ErrorCode } from '../../../../contracts/errors.js';
import { isOverdue, type ExamTiming, type Snapshot } from '../../exam-rules/index.js';
import { feedbackEachQuestion, statusOf, type ShareState } from './policy.js';

/**
 * The rules of one person's attempt at an exam or practice share (M30, DEC-39). Pure: the
 * caller passes the share, the attempt as stored and the moment.
 */

/** What these rules read of a stored attempt. */
export interface AttemptState {
  status: 'active' | 'submitted';
  position: number;
  deadline_at: Date | null;
}

/** A name as people type it: no outer spaces, single inner spaces, any case. */
const normalizedName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Who is taking it, for counting attempts per person: never stored as the name itself. */
export const personKeyOf = (shareId: string, name: string, personId?: string) =>
  createHash('sha256')
    .update(JSON.stringify([shareId, normalizedName(name), normalizedName(personId ?? '')]))
    .digest('hex');

const digest = (value: string) => createHash('sha256').update(value).digest();

/** The access code given equals the share's, compared in constant time. */
export const codeMatches = (given: string | undefined, expected: string) =>
  given !== undefined && timingSafeEqual(digest(given.trim()), digest(expected.trim()));

/** The attempt's timing in the exam rules' terms: a total time when it has a deadline. */
export const timingOf = (attempt: AttemptState): ExamTiming => ({
  timing: attempt.deadline_at ? 'total' : 'none',
  timing_seconds: null,
  deadline_at: attempt.deadline_at,
  status: attempt.status === 'active' ? 'active' : 'finished',
});

/** Exams follow the policy's navigation; practice is always free. */
export const navigationOf = (share: Pick<ShareState, 'kind' | 'policy'>) =>
  share.kind === 'practice' ? 'free' : share.policy.limits.navigation;

/**
 * Why an active attempt ends now without its person: its time is over, or the share is over
 * (the owner ended or archived it: `owner`; its end date passed: `time`). Null: it goes on.
 */
export function endingOf(share: ShareState, attempt: AttemptState, now: Date) {
  if (attempt.status !== 'active') return null;
  if (isOverdue(timingOf(attempt), now)) return 'time' as const;
  if (share.archivedAt || share.endedAt) return 'owner' as const;
  return statusOf(share, now) === 'ended' ? ('time' as const) : null;
}

/** Why this item's answer cannot be changed now; null when it can. */
export function lockOf(
  share: ShareState,
  attempt: AttemptState,
  item: { position: number; chosen: string[] | null },
  now: Date,
): ErrorCode | null {
  if (attempt.status !== 'active' || isOverdue(timingOf(attempt), now)) return 'exam_ended';
  if (navigationOf(share) === 'forward' && item.position < attempt.position)
    return 'question_locked';
  if (feedbackEachQuestion(share) && item.chosen !== null) return 'already_answered';
  return null;
}

/** What is wrong with a choice for this question: a letter it does not have, or too many. */
export function choiceProblem(snapshot: Snapshot, chosen: readonly string[]) {
  const offered = snapshot.options.map((option) => option.letter);
  if (chosen.some((letter) => !offered.includes(letter))) return 'invalid_value';
  return !snapshot.multiSelect && new Set(chosen).size > 1 ? 'too_big' : null;
}

/** The score of `correct` out of `total`, in percent to one decimal, and the pass mark's verdict. */
export function scoreOf(correct: number, total: number, passPercent: number | null) {
  const percent = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  return { correct, total, percent, passed: passPercent === null ? null : percent >= passPercent };
}
