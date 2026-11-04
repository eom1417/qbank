import type {
  AnalyticsSummary,
  ImportQualityResponse,
  SessionHistoryResponse,
  SuggestionResponse,
  TrendResponse,
} from '../../../../contracts/analytics.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import { stateOf, type Attempt, type QuestionState } from '../domain/mastery.js';
import { accuracy, score, SMALL_SAMPLE } from '../domain/metrics.js';
import { groupOf, mixGroups } from '../domain/selection.js';
import type { StudyDeps } from './deps.js';

/** The banks a figure covers: one of the account's, or all of them (FR-16-008, UAT-066). */
async function banksOf(deps: StudyDeps, actor: Actor, bankId: string | undefined) {
  if (bankId === undefined || bankId === '') return deps.bankIdsOf(actor.accountId);
  if (!isId(bankId) || !(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
  return [bankId];
}

const average = (values: readonly number[]) =>
  values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

function learningOf(states: readonly QuestionState[]) {
  return {
    new: states.filter((s) => s.attempts === 0).length,
    answered: states.filter((s) => s.attempts > 0).length,
    weak: states.filter((s) => groupOf(s) === 'weak').length,
    mastered: states.filter((s) => s.level === 'mastered').length,
    due: states.filter((s) => s.attempts > 0 && s.isDue).length,
  };
}

/** The library in real numbers, for one bank or all (FR-16-001, FR-16-002, FR-16-005, FR-16-009). */
export async function librarySummary(
  deps: StudyDeps,
  actor: Actor,
  bankId?: string,
): Promise<AnalyticsSummary> {
  const bankIds = await banksOf(deps, actor, bankId);
  const pool = await deps.questions.studyPool(actor.accountId, { bankIds });
  const history = await deps.sessions.attemptHistory(actor.accountId);
  const now = deps.clock.now();
  const attempts = pool.flatMap((q) => [...(history.get(q.id) ?? [])]);
  const reported = await deps.questions.reportedQuestionIds(actor.accountId);
  const sessions = (await deps.sessions.sessionHistory(actor.accountId)).filter(
    (s) => s.status === 'finished' && inBanks(s.scope, bankIds),
  );
  return {
    questions: await deps.questions.statusCounts(actor.accountId, bankId ? bankIds : null),
    learning: learningOf(pool.map((q) => stateOf(history.get(q.id) ?? [], now))),
    accuracy: accuracy(attempts.filter((a) => a.correct).length, attempts.length),
    seconds: {
      perQuestion: average(attempts.flatMap((a) => (a.seconds ? [a.seconds] : []))),
      perSession: average(sessions.map((s) => Number(s.seconds)).filter((s) => s > 0)),
    },
    possibleQuestionProblems: pool.filter(
      (q) => reported.has(q.id) && history.get(q.id)?.at(-1)?.correct === false,
    ).length,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** The Monday (UTC) of the week an attempt falls in. */
function weekOf(at: Date): number {
  const day = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY_MS;
}

interface Week {
  start: number;
  list: Attempt[];
}

/** Attempts grouped by week, oldest week first. */
function byWeek(attempts: readonly Attempt[]): Week[] {
  const weeks = new Map<number, Attempt[]>();
  for (const attempt of attempts) {
    const start = weekOf(attempt.at);
    weeks.set(start, [...(weeks.get(start) ?? []), attempt]);
  }
  const list = Array.from(weeks.entries(), (entry) => ({ start: entry[0], list: entry[1] }));
  return list.sort((a, b) => a.start - b.start);
}

function weekRow(week: Week) {
  return {
    weekStart: new Date(week.start).toISOString(),
    accuracy: accuracy(week.list.filter((a) => a.correct).length, week.list.length),
    smallSample: SMALL_SAMPLE > week.list.length,
  };
}

/** Accuracy week by week, each small week marked (FR-16-003, UAT-065). */
export async function trend(
  deps: StudyDeps,
  actor: Actor,
  filter: { bankId?: string | undefined; weeks: number },
): Promise<TrendResponse> {
  const bankIds = await banksOf(deps, actor, filter.bankId);
  const pool = await deps.questions.studyPool(actor.accountId, { bankIds });
  const history = await deps.sessions.attemptHistory(actor.accountId);
  const since = deps.clock.now().getTime() - filter.weeks * WEEK_MS;
  const attempts = pool
    .flatMap((q) => [...(history.get(q.id) ?? [])])
    .filter((a) => a.at.getTime() >= since);
  return { weeks: byWeek(attempts).map(weekRow) };
}

function inBanks(scope: unknown, bankIds: readonly string[]) {
  const ids = (scope as { bankIds?: string[] }).bankIds ?? [];
  return ids.some((id) => bankIds.includes(id));
}

/** Every session with its result and time, newest first, by bank and mode (FR-16-006, FR-16-008). */
export async function sessionHistory(
  deps: StudyDeps,
  actor: Actor,
  filter: { bankId?: string | undefined; mode?: 'tutor' | 'exam' | undefined },
): Promise<SessionHistoryResponse> {
  const bankIds = await banksOf(deps, actor, filter.bankId);
  const rows = (await deps.sessions.sessionHistory(actor.accountId)).filter(
    (row) =>
      (!filter.mode || row.mode === filter.mode) &&
      (row.kind === 'retry' || inBanks(row.scope, bankIds)),
  );
  return {
    sessions: rows.map((row) => ({
      id: row.id,
      mode: row.mode,
      kind: row.kind,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      bankIds: (row.scope as { bankIds?: string[] }).bankIds ?? [],
      score: score(Number(row.correct), Number(row.total)),
      accuracy: accuracy(Number(row.correct), Number(row.answered)),
      seconds: Number(row.seconds),
    })),
  };
}

/** What each source's import gave, apart from learning (FR-16-007). */
export async function importQuality(
  deps: StudyDeps,
  actor: Actor,
  bankId: string,
): Promise<ImportQualityResponse> {
  const [checked] = await banksOf(deps, actor, bankId);
  return { sources: await deps.questions.qualityBySource(actor.accountId, checked ?? '') };
}

/** One useful next session (FR-16-010): what is due, else weak ones, else a mix, else new ones. */
export async function suggestion(
  deps: StudyDeps,
  actor: Actor,
  bankId?: string,
): Promise<SuggestionResponse> {
  const bankIds = await banksOf(deps, actor, bankId);
  if (bankIds.length === 0) return { kind: null, available: 0 };
  const pool = await deps.questions.studyPool(actor.accountId, { bankIds });
  const groups = mixGroups(
    pool,
    await deps.sessions.attemptHistory(actor.accountId),
    deps.clock.now(),
  );
  if (groups.due.length > 0) return { kind: 'due', available: groups.due.length };
  if (groups.weak.length >= 5) return { kind: 'weak', available: groups.weak.length };
  if (groups.weak.length > 0)
    return { kind: 'smart_mix', available: groups.weak.length + groups.new.length };
  return groups.new.length > 0
    ? { kind: 'new', available: groups.new.length }
    : { kind: null, available: 0 };
}
