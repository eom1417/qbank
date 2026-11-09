import type { ShareResultsResponse } from '../../../../contracts/sharing.js';
import { notFound } from '../../../platform/errors/index.js';
import type { Snapshot } from '../../exam-rules/index.js';
import type { Actor } from '../../identity/index.js';
import type { AttemptItemRow, AttemptRow } from '../adapters/attempt-repository.js';
import { scoreOf } from '../domain/attempt.js';
import type { ChannelsDeps } from './deps.js';
import { shareOf } from './governance.js';
import { ownedChannel } from './manage.js';
import { settle } from './take-attempt.js';

type Line = ShareResultsResponse['attempts'][number];
type QuestionLine = ShareResultsResponse['questions'][number];
type ItemLine = Pick<AttemptItemRow, 'question_id' | 'snapshot' | 'chosen' | 'correct'>;

const NO_SCORE = { correct: null, percent: null, passed: null };

/** The score of a handed-in attempt; nothing while it is under way. */
function scoreLine(attempt: AttemptRow, passPercent: number | null) {
  if (attempt.status !== 'submitted' || attempt.correct === null) return NO_SCORE;
  const { correct, percent, passed } = scoreOf(attempt.correct, attempt.total, passPercent);
  return { correct, percent, passed };
}

/** Who took it: only when the share keeps names. */
const personOf = (attempt: AttemptRow, named: boolean) =>
  named
    ? { name: attempt.person_name, personId: attempt.person_ref }
    : { name: null, personId: null };

function lineOf(attempt: AttemptRow, named: boolean, passPercent: number | null): Line {
  return {
    id: attempt.id,
    ...personOf(attempt, named),
    version: attempt.version,
    status: attempt.status,
    endedBy: attempt.ended_by,
    startedAt: attempt.started_at.toISOString(),
    submittedAt: attempt.submitted_at?.toISOString() ?? null,
    total: attempt.total,
    ...scoreLine(attempt, passPercent),
  };
}

function summaryOf(lines: readonly Line[], passPercent: number | null) {
  const percents = lines.flatMap((line) => (line.percent === null ? [] : [line.percent]));
  const average = percents.reduce((sum, percent) => sum + percent, 0) / percents.length;
  return {
    started: lines.length,
    submitted: percents.length,
    averagePercent: percents.length > 0 ? Math.round(average * 10) / 10 : null,
    passed: passPercent === null ? null : lines.filter((line) => line.passed === true).length,
  };
}

/** How each question fared across the attempts, as it was asked. */
function questionsOf(items: readonly ItemLine[]): QuestionLine[] {
  const byQuestion = new Map<string, QuestionLine>();
  for (const item of items) {
    if (!item.question_id) continue;
    const line = byQuestion.get(item.question_id) ?? {
      questionId: item.question_id,
      stem: (item.snapshot as Snapshot).stem.slice(0, 200),
      asked: 0,
      answered: 0,
      correct: 0,
    };
    line.asked += 1;
    if (item.chosen !== null) line.answered += 1;
    if (item.correct === true && item.chosen !== null) line.correct += 1;
    byQuestion.set(item.question_id, line);
  }
  return [...byQuestion.values()];
}

/** `GET /api/shares/:id/results`: the owner's exam/practice share, each attempt and question. */
export async function shareResults(
  deps: ChannelsDeps,
  actor: Actor,
  id: string,
): Promise<ShareResultsResponse> {
  const row = await ownedChannel(deps, actor, id);
  if (row.kind === 'agent') throw notFound();
  const share = shareOf(row);
  const stored = await deps.attempts.ofChannel(row.id);
  const attempts = await Promise.all(stored.map((a) => settle(deps, row, share, a)));
  const { passPercent } = share.policy.content;
  const named = share.policy.records.identify === 'named';
  const lines = attempts.map((attempt) => lineOf(attempt, named, passPercent));
  return {
    attempts: lines,
    summary: summaryOf(lines, passPercent),
    questions: questionsOf(await deps.attempts.itemsOfChannel(row.id)),
  };
}
