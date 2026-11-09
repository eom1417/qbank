import type { SessionRow } from '../adapters/session-repository.js';
import { isCorrect, isOverdue, type Snapshot } from '../../exam-rules/index.js';
import type { StudyDeps } from './deps.js';
import { noteDifficulty } from './difficulty.js';

/**
 * Grades every saved answer of an exam against its snapshot and ends it (FR-13-011). An item
 * with no saved answer stays unanswered: shown apart, never counted as answered (DEC-08).
 */
export async function submitSession(deps: StudyDeps, session: SessionRow, by: 'owner' | 'time') {
  const items = await deps.sessions.itemsOf(session.owner_id, session.id);
  const graded = items
    .filter((item) => (item.chosen ?? []).length > 0)
    .map((item) => ({
      position: item.position,
      correct: isCorrect(item.chosen ?? [], (item.snapshot as Snapshot).answers),
    }));
  const now = deps.clock.now();
  await deps.sessions.submitExam(session.owner_id, session.id, graded, { by, now });
  const answered = items.filter((item) => item.question_id && (item.chosen ?? []).length > 0);
  for (const item of answered)
    await noteDifficulty(deps, session.owner_id, item.question_id as string);
}

/**
 * The server's clock decides the end (M10.6): an exam past its deadline is submitted with what
 * was saved, whatever the browser shows, before anything else reads or changes it. Returns the
 * session as it now stands.
 */
export async function settleOverdue(deps: StudyDeps, session: SessionRow): Promise<SessionRow> {
  if (session.mode !== 'exam' || !isOverdue(session, deps.clock.now())) return session;
  await submitSession(deps, session, 'time');
  return (await deps.sessions.findSession(session.owner_id, session.id)) ?? session;
}
