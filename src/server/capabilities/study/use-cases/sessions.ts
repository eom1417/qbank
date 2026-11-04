import type {
  SessionResponse,
  StartSessionRequest,
  StudyKind,
  StudyScope,
} from '../../../../contracts/study.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { PoolQuestion } from '../../questions/index.js';
import type { SessionRow } from '../adapters/session-repository.js';
import type { Snapshot } from '../domain/grading.js';
import { candidatesFor, shuffled, type LastAttempt } from '../domain/selection.js';
import type { StudyDeps } from './deps.js';

/** Every bank in the scope must be the account's; anyone else's is the neutral not-found. */
async function checkScope(deps: StudyDeps, actor: Actor, scope: StudyScope) {
  for (const bankId of scope.bankIds)
    if (!(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
}

/** The questions a session of this kind and scope may ask now, each text once. */
async function candidates(deps: StudyDeps, actor: Actor, scope: StudyScope, kind: StudyKind) {
  await checkScope(deps, actor, scope);
  const pool = await deps.questions.studyPool(actor.accountId, {
    ...scope,
    flaggedOnly: kind === 'flagged' || scope.flaggedOnly === true,
  });
  const history = new Map<string, LastAttempt>(
    (await deps.sessions.lastAttempts(actor.accountId)).map((a) => [a.questionId, a]),
  );
  return candidatesFor(kind, pool, history, deps.clock.now());
}

/** How many questions the scope offers before starting (FR-12-001, FR-03-006, UI-13). */
export async function preview(deps: StudyDeps, actor: Actor, scope: StudyScope, kind: StudyKind) {
  return { available: (await candidates(deps, actor, scope, kind)).length };
}

const snapshotOf = (q: PoolQuestion): Snapshot => ({
  stem: q.stem,
  options: q.options,
  answers: q.answers,
  multiSelect: q.multiSelect,
  explanation: q.explanation,
  pictureIds: q.pictureIds,
  chapterId: q.chapterId,
  version: q.version,
});

function toSession(row: SessionRow, answered: number): SessionResponse {
  return {
    id: row.id,
    mode: row.mode,
    kind: row.kind,
    total: row.size,
    answered,
    position: row.position,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Starts a session (FR-12-001, FR-12-002): with fewer questions than asked it is refused with
 * the number available, so the owner chooses; it never fills up by repeating (FR-14-006).
 */
export async function startSession(deps: StudyDeps, actor: Actor, request: StartSessionRequest) {
  const found = await candidates(deps, actor, request.scope, request.kind);
  if (found.length < request.size)
    throw new AppError('not_enough_questions', { available: String(found.length) });
  const chosen = shuffled(found, deps.random).slice(0, request.size);
  const id = deps.newId();
  const items = chosen.map((q) => ({ questionId: q.id, snapshot: snapshotOf(q) }));
  const now = deps.clock.now();
  await deps.sessions.createSession({
    id,
    ownerId: actor.accountId,
    mode: request.mode,
    kind: request.kind,
    scope: request.scope,
    now,
    items,
  });
  return getSession(deps, actor, id);
}

export async function ownedSession(deps: StudyDeps, actor: Actor, id: string) {
  const row = isId(id) ? await deps.sessions.findSession(actor.accountId, id) : undefined;
  if (!row) throw notFound();
  return row;
}

export async function getSession(deps: StudyDeps, actor: Actor, id: string) {
  const row = await ownedSession(deps, actor, id);
  const counts = await deps.sessions.answeredCounts([row.id]);
  return toSession(row, counts.get(row.id) ?? 0);
}

/** Sessions still open, to carry on from any device (FR-12-008, FR-01-006). */
export async function activeSessions(deps: StudyDeps, actor: Actor) {
  const rows = await deps.sessions.activeSessions(actor.accountId);
  const counts = await deps.sessions.answeredCounts(rows.map((row) => row.id));
  return { sessions: rows.map((row) => toSession(row, counts.get(row.id) ?? 0)) };
}

/** Remembers where the owner is in the session, to come back to the same place. */
export async function setPosition(deps: StudyDeps, actor: Actor, id: string, position: number) {
  const row = await ownedSession(deps, actor, id);
  if (position >= row.size) throw new AppError('validation_failed', { position: 'too_big' });
  await deps.sessions.setPosition(actor.accountId, id, position, deps.clock.now());
  return getSession(deps, actor, id);
}

export async function finishSession(deps: StudyDeps, actor: Actor, id: string) {
  await ownedSession(deps, actor, id);
  await deps.sessions.finish(actor.accountId, id, deps.clock.now());
  return getSession(deps, actor, id);
}
