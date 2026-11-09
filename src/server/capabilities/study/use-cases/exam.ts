import type { AnswerImpactResponse, ExamStateResponse } from '../../../../contracts/study.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import { canChange, isCorrect, secondsLeft } from '../../exam-rules/index.js';
import type { StudyDeps } from './deps.js';
import { itemAt, toItem } from './items.js';
import { ownedSession } from './sessions.js';
import { submitSession } from './submission.js';

async function examSession(deps: StudyDeps, actor: Actor, id: string) {
  const session = await ownedSession(deps, actor, id);
  if (session.mode !== 'exam') throw new AppError('validation_failed', { mode: 'invalid_value' });
  return session;
}

/**
 * The exam's map and clock (FR-13-008, UI-17, UI-18): answered, flagged and changeable per
 * question, by the server's time. Nothing about correctness before submission (UAT-051).
 */
export async function examState(
  deps: StudyDeps,
  actor: Actor,
  id: string,
): Promise<ExamStateResponse> {
  const session = await examSession(deps, actor, id);
  const items = await deps.sessions.itemsOf(actor.accountId, session.id);
  const now = deps.clock.now();
  const current = items[session.position];
  return {
    status: session.status,
    timing: session.timing,
    secondsLeft:
      session.status === 'active' ? secondsLeft(session, current?.opened_at ?? null, now) : null,
    position: session.position,
    items: items.map((item) => ({
      position: item.position,
      answered: (item.chosen ?? []).length > 0,
      flagged: item.flagged,
      changeable: canChange(session, item, session.position, now),
    })),
  };
}

/**
 * Shows a question of the exam and moves there (FR-13-008). Per-question timing goes forward
 * only and starts the question's clock on its first showing (FR-13-004, DEC-07 assumed).
 */
export async function openExamItem(deps: StudyDeps, actor: Actor, id: string, position: number) {
  const view = await itemAt(deps, actor, id, position);
  if (view.session.mode !== 'exam')
    throw new AppError('validation_failed', { mode: 'invalid_value' });
  if (view.session.status === 'active') {
    if (view.session.timing === 'per_question' && position < view.session.position)
      throw new AppError('question_locked');
    const now = deps.clock.now();
    const key = { ownerId: actor.accountId, sessionId: id, position };
    if (view.session.timing === 'per_question') await deps.sessions.openItem(key, now);
    await deps.sessions.setPosition(actor.accountId, id, position, now);
  }
  return toItem(deps, actor, await itemAt(deps, actor, id, position));
}

/** Saves the answer as chosen so far (FR-13-007); refused once its time or the exam is over. */
export async function saveChoice(
  deps: StudyDeps,
  actor: Actor,
  ref: { id: string; position: number },
  chosen: string[],
) {
  const view = await itemAt(deps, actor, ref.id, ref.position);
  const { session, item } = view;
  if (session.mode !== 'exam') throw new AppError('validation_failed', { mode: 'invalid_value' });
  if (session.status !== 'active') throw new AppError('exam_ended');
  if (!canChange(session, item, session.position, deps.clock.now()))
    throw new AppError('question_locked');
  const letters = new Set(
    (item.snapshot as { options: { letter: string }[] }).options.map((o) => o.letter),
  );
  if (!chosen.every((letter) => letters.has(letter)))
    throw new AppError('validation_failed', { chosen: 'invalid_value' });
  const key = { ownerId: actor.accountId, sessionId: ref.id, position: ref.position };
  await deps.sessions.saveChoice(key, [...new Set(chosen)].sort(), deps.clock.now());
  return toItem(deps, actor, await itemAt(deps, actor, ref.id, ref.position));
}

/** The exam item's own flag (FR-13-009); it survives leaving and coming back (UAT-053). */
export async function flagExamItem(
  deps: StudyDeps,
  actor: Actor,
  ref: { id: string; position: number },
  flagged: boolean,
) {
  const session = await examSession(deps, actor, ref.id);
  if (session.status !== 'active') throw new AppError('exam_ended');
  await deps.sessions.setItemFlag(
    { ownerId: actor.accountId, sessionId: ref.id, position: ref.position },
    flagged,
  );
  return toItem(deps, actor, await itemAt(deps, actor, ref.id, ref.position));
}

/** The owner submits after the check (FR-13-010); a second submission changes nothing. */
export async function submitExam(deps: StudyDeps, actor: Actor, id: string) {
  const session = await examSession(deps, actor, id);
  if (session.status === 'active') await submitSession(deps, session, 'owner');
}

/**
 * What changing a question's key would mean for past attempts (FR-07-007, FR-24-004, UAT-031):
 * how many there are, and how many would come out differently. They stay as they were graded,
 * on the version they saw; nothing is rewritten.
 */
export async function answerImpact(
  deps: StudyDeps,
  actor: Actor,
  questionId: string,
  answers: string[],
): Promise<AnswerImpactResponse> {
  if (!isId(questionId)) throw notFound();
  const attempts = await deps.sessions.attemptsOf(actor.accountId, questionId);
  const wouldChange = attempts.filter(
    (a) =>
      (a.chosen ?? []).length > 0 && isCorrect(a.chosen ?? [], answers) !== (a.correct === true),
  ).length;
  return {
    attempts: attempts.length,
    sessions: new Set(attempts.map((a) => a.session_id)).size,
    wouldChange,
  };
}
