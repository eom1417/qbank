import type { ItemResponse, SummaryResponse } from '../../../../contracts/study.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import type { ItemRow } from '../adapters/session-repository.js';
import { isCorrect, type Snapshot } from '../domain/grading.js';
import type { StudyDeps } from './deps.js';
import { getSession, ownedSession } from './sessions.js';

async function itemAt(deps: StudyDeps, actor: Actor, sessionId: string, position: number) {
  const session = await ownedSession(deps, actor, sessionId);
  const items = await deps.sessions.itemsOf(actor.accountId, session.id);
  const item = items[position];
  if (!item) throw notFound();
  return { session, item, total: items.length };
}

/**
 * One question of the session as it was snapshotted. Its solution (right answers and the
 * book's explanation) is only included once it was answered (FR-12-003, UAT-041).
 */
async function toItem(
  deps: StudyDeps,
  actor: Actor,
  item: ItemRow,
  total: number,
): Promise<ItemResponse> {
  const snapshot = item.snapshot as Snapshot;
  const [mark] = item.question_id
    ? await deps.questions.marksOf(actor.accountId, [item.question_id])
    : [];
  const answered = item.answered_at !== null;
  return {
    position: item.position,
    total,
    questionId: item.question_id,
    stem: snapshot.stem,
    options: snapshot.options,
    multiSelect: snapshot.multiSelect,
    pictureIds: snapshot.pictureIds,
    flagged: mark?.flagged ?? false,
    favorite: mark?.favorite ?? false,
    solution: answered
      ? {
          chosen: item.chosen ?? [],
          correct: item.correct === true,
          answers: snapshot.answers,
          explanation: snapshot.explanation,
        }
      : null,
  };
}

export async function getItem(deps: StudyDeps, actor: Actor, sessionId: string, position: number) {
  const { item, total } = await itemAt(deps, actor, sessionId, position);
  return toItem(deps, actor, item, total);
}

/**
 * Sends the answer (FR-12-003, FR-12-006): graded against the snapshot, recorded once with its
 * time, then the solution is shown. A second answer to the same item is refused (UAT-045).
 */
export async function answerItem(
  deps: StudyDeps,
  actor: Actor,
  ref: { sessionId: string; position: number },
  answer: { chosen: string[]; seconds: number },
) {
  const { session, item, total } = await itemAt(deps, actor, ref.sessionId, ref.position);
  const snapshot = item.snapshot as Snapshot;
  const letters = new Set(snapshot.options.map((o) => o.letter));
  if (!answer.chosen.every((letter) => letters.has(letter)))
    throw new AppError('validation_failed', { chosen: 'invalid_value' });
  if (!snapshot.multiSelect && answer.chosen.length > 1)
    throw new AppError('validation_failed', { chosen: 'too_big' });
  const now = deps.clock.now();
  const chosen = [...new Set(answer.chosen)].sort();
  const recorded = await deps.sessions.answerItem(
    { ownerId: actor.accountId, sessionId: session.id, position: ref.position },
    { chosen, correct: isCorrect(chosen, snapshot.answers), seconds: answer.seconds, now },
  );
  if (!recorded) throw new AppError('already_answered');
  const [saved] = (await deps.sessions.itemsOf(actor.accountId, session.id)).filter(
    (i) => i.position === item.position,
  );
  return toItem(deps, actor, saved ?? item, total);
}

/** The end of the session (FR-12-010, UI-15): counts with what each is out of, and the wrong ones. */
export async function summary(
  deps: StudyDeps,
  actor: Actor,
  sessionId: string,
): Promise<SummaryResponse> {
  const session = await ownedSession(deps, actor, sessionId);
  const items = await deps.sessions.itemsOf(actor.accountId, session.id);
  const answered = items.filter((i) => i.answered_at !== null);
  const correct = answered.filter((i) => i.correct === true).length;
  const chapters = new Map<string | null, { answered: number; correct: number }>();
  for (const item of answered) {
    const chapterId = (item.snapshot as Snapshot).chapterId;
    const counts = chapters.get(chapterId) ?? { answered: 0, correct: 0 };
    chapters.set(chapterId, {
      answered: counts.answered + 1,
      correct: counts.correct + (item.correct ? 1 : 0),
    });
  }
  return {
    total: items.length,
    answered: answered.length,
    correct,
    wrong: answered.length - correct,
    skipped: items.length - answered.length,
    seconds: answered.reduce((sum, i) => sum + (i.seconds ?? 0), 0),
    byChapter: [...chapters].map(([chapterId, counts]) => ({ chapterId, ...counts })),
    wrongItems: answered
      .filter((i) => i.correct === false)
      .map((i) => ({ position: i.position, excerpt: (i.snapshot as Snapshot).stem.slice(0, 160) })),
  };
}

/**
 * A new session of only this session's wrong questions (FR-12-011, UAT-046), as they were asked.
 * With none wrong it is refused, so the screen can say so instead of opening an empty session.
 */
export async function retryWrong(deps: StudyDeps, actor: Actor, sessionId: string) {
  const session = await ownedSession(deps, actor, sessionId);
  const wrong = (await deps.sessions.itemsOf(actor.accountId, session.id)).filter(
    (i) => i.correct === false,
  );
  if (wrong.length === 0) throw new AppError('nothing_to_retry');
  const id = deps.newId();
  await deps.sessions.createSession({
    id,
    ownerId: actor.accountId,
    mode: 'tutor',
    kind: 'retry',
    scope: { retryOf: session.id },
    now: deps.clock.now(),
    items: wrong.map((i) => ({ questionId: i.question_id, snapshot: i.snapshot as Snapshot })),
  });
  return getSession(deps, actor, id);
}
