import type {
  SessionResponse,
  StartSessionRequest,
  ExamTiming,
  StudyKind,
  StudyScope,
} from '../../../../contracts/study.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { PoolQuestion } from '../../questions/index.js';
import type { SessionRow } from '../adapters/session-repository.js';
import { deadlineFor, shuffled, type Snapshot } from '../../exam-rules/index.js';
import { settleOverdue } from './submission.js';
import { candidatesFor, mixGroups, smartMix } from '../domain/selection.js';
import { DEFAULT_SHARES } from '../domain/smart-mix.js';
import type { StudyDeps } from './deps.js';

/** Every bank in the scope must be the account's; anyone else's is the neutral not-found. */
async function checkScope(deps: StudyDeps, actor: Actor, scope: StudyScope) {
  for (const bankId of scope.bankIds)
    if (!(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
}

/** The questions a session of this kind and scope may ask now, each text once. */
/** The scope's eligible questions and the owner's whole record, read once. */
async function poolAndHistory(deps: StudyDeps, actor: Actor, scope: StudyScope, kind: StudyKind) {
  await checkScope(deps, actor, scope);
  const pool = await deps.questions.studyPool(actor.accountId, {
    ...scope,
    flaggedOnly: kind === 'flagged' || scope.flaggedOnly === true,
  });
  return { pool, history: await deps.sessions.attemptHistory(actor.accountId) };
}

/** The questions a session of this kind and scope may ask now, each text once. */
async function candidates(deps: StudyDeps, actor: Actor, scope: StudyScope, kind: StudyKind) {
  const { pool, history } = await poolAndHistory(deps, actor, scope, kind);
  return candidatesFor(kind, pool, history, deps.clock.now());
}

/** The Smart Mix groups of the scope (new, weak, due). */
async function groupsFor(deps: StudyDeps, actor: Actor, scope: StudyScope) {
  const { pool, history } = await poolAndHistory(deps, actor, scope, 'smart_mix');
  return mixGroups(pool, history, deps.clock.now());
}

/**
 * How many questions the scope offers before starting (FR-12-001, FR-03-006, UI-13); a Smart
 * Mix also says how many each group has, so its real shares can be shown (FR-14-002).
 */
export async function preview(deps: StudyDeps, actor: Actor, scope: StudyScope, kind: StudyKind) {
  if (kind !== 'smart_mix')
    return { available: (await candidates(deps, actor, scope, kind)).length };
  const groups = await groupsFor(deps, actor, scope);
  const counts = { new: groups.new.length, weak: groups.weak.length, due: groups.due.length };
  return { available: counts.new + counts.weak + counts.due, groups: counts };
}

/** The questions a new session asks, with the real Smart Mix counts when it is one. */
async function pickQuestions(deps: StudyDeps, actor: Actor, request: StartSessionRequest) {
  if (request.kind === 'smart_mix') {
    const groups = await groupsFor(deps, actor, request.scope);
    const total = groups.new.length + groups.weak.length + groups.due.length;
    if (total < request.size)
      throw new AppError('not_enough_questions', { available: String(total) });
    const { picks, counts } = smartMix(groups, request.size, deps.random, request.shares);
    return { picks: picks.map((p) => ({ q: p.question, reason: p.reason })), mix: counts };
  }
  const found = await candidates(deps, actor, request.scope, request.kind);
  if (found.length < request.size)
    throw new AppError('not_enough_questions', { available: String(found.length) });
  const chosen = shuffled(found, deps.random).slice(0, request.size);
  return { picks: chosen.map((q) => ({ q, reason: undefined })), mix: null };
}

const snapshotOf = (q: PoolQuestion, reason: Snapshot['reason']): Snapshot => ({
  ...(reason ? { reason } : {}),
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
    mix: (row.scope as { mix?: SessionResponse['mix'] }).mix ?? null,
    timing: row.timing,
    timingSeconds: row.timing_seconds,
    endedBy: row.ended_by,
  };
}

/** An exam's timing as announced; the clock starts now, when start was pressed (UAT-049). */
function timingOf(timing: ExamTiming, now: Date) {
  const seconds = timing.kind === 'none' ? null : timing.seconds;
  return { kind: timing.kind, seconds, deadline: deadlineFor(timing.kind, seconds, now) };
}

/**
 * Starts a session (FR-12-001, FR-12-002): with fewer questions than asked it is refused with
 * the number available, so the owner chooses; it never fills up by repeating (FR-14-006).
 */
export async function startSession(deps: StudyDeps, actor: Actor, request: StartSessionRequest) {
  const { picks, mix } = await pickQuestions(deps, actor, request);
  const id = deps.newId();
  const items = picks.map((p) => ({ questionId: p.q.id, snapshot: snapshotOf(p.q, p.reason) }));
  const now = deps.clock.now();
  await deps.sessions.createSession({
    id,
    ownerId: actor.accountId,
    mode: request.mode,
    kind: request.kind,
    scope: { ...request.scope, ...(mix ? { mix, shares: request.shares ?? DEFAULT_SHARES } : {}) },
    now,
    items,
    ...(request.mode === 'exam' ? { timing: timingOf(request.timing, now) } : {}),
  });
  return getSession(deps, actor, id);
}

export async function ownedSession(deps: StudyDeps, actor: Actor, id: string) {
  const row = isId(id) ? await deps.sessions.findSession(actor.accountId, id) : undefined;
  if (!row) throw notFound();
  return settleOverdue(deps, row);
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
