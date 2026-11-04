import type { StudyKind } from '../../../../contracts/study.js';
import type { PoolQuestion } from '../../questions/index.js';

/** The owner's last answer to a question, from earlier sessions. */
export interface LastAttempt {
  questionId: string;
  correct: boolean;
  answeredAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Due again (interim until M11's spaced review): a wrong answer a day later, a right one after a
 * week. A question never answered is "new", not due.
 */
function isDue(last: LastAttempt, now: Date): boolean {
  const waited = now.getTime() - last.answeredAt.getTime();
  return waited >= (last.correct ? 7 : 1) * DAY_MS;
}

/** Whether a question fits the session kind (FR-12-002). Flagged is filtered in the pool. */
function fitsKind(kind: StudyKind, last: LastAttempt | undefined, now: Date): boolean {
  if (kind === 'new') return last === undefined;
  if (kind === 'wrong') return last !== undefined && !last.correct;
  if (kind === 'due') return last !== undefined && isDue(last, now);
  return true;
}

/**
 * One question per exact text (FR-14-006, FR-10-005, UAT-059): the same question kept twice in
 * a bank is never asked twice in one session. Similar but different questions all stay.
 */
function oncePerText(pool: readonly PoolQuestion[]): PoolQuestion[] {
  const seen = new Set<string>();
  return pool.filter((question) => {
    if (seen.has(question.exactKey)) return false;
    seen.add(question.exactKey);
    return true;
  });
}

/** The questions a session of this kind may draw from, each text once. */
export function candidatesFor(
  kind: StudyKind,
  pool: readonly PoolQuestion[],
  history: ReadonlyMap<string, LastAttempt>,
  now: Date,
): PoolQuestion[] {
  return oncePerText(pool.filter((q) => fitsKind(kind, history.get(q.id), now)));
}

/** A fair random order (Fisher–Yates) with the given source of randomness. */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
