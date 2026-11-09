import type {
  TakeItemResponse,
  TakeResultResponse,
  TakeStateResponse,
} from '../../../../contracts/take.js';
import { isCorrect, secondsLeft, type Snapshot } from '../../exam-rules/index.js';
import type { AttemptItemRow, AttemptRow } from '../adapters/attempt-repository.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import { lockOf, navigationOf, scoreOf, timingOf } from '../domain/attempt.js';
import { feedbackEachQuestion, reveals, revealNow, type ShareState } from '../domain/policy.js';

/**
 * What a person taking a share sees (M30): only what its policy shows at this moment. An exam's
 * answers never appear before it is handed in.
 */

export interface Taking {
  row: ChannelRow;
  share: ShareState;
  attempt: AttemptRow;
}

const snapshotIn = (item: AttemptItemRow) => item.snapshot as Snapshot;

/** Practice with an immediate reveal: the answer once the question is answered. */
function feedbackOf(share: ShareState, item: AttemptItemRow) {
  if (!feedbackEachQuestion(share) || item.chosen === null) return null;
  const snapshot = snapshotIn(item);
  return {
    correct: isCorrect(item.chosen, snapshot.answers),
    answers: snapshot.answers,
    explanation: reveals(share.policy.reveal.level, 'explained') ? snapshot.explanation : null,
  };
}

export function itemView(taking: Taking, item: AttemptItemRow, now: Date): TakeItemResponse {
  const snapshot = snapshotIn(item);
  return {
    position: item.position,
    total: taking.attempt.total,
    stem: snapshot.stem,
    options: snapshot.options.map(({ letter, label, text }) => ({ letter, label, text })),
    multiSelect: snapshot.multiSelect,
    pictureIds: snapshot.pictureIds,
    saved: item.chosen ?? [],
    flagged: item.flagged,
    changeable: lockOf(taking.share, taking.attempt, item, now) === null,
    feedback: feedbackOf(taking.share, item),
  };
}

export function stateView(
  taking: Taking,
  items: readonly AttemptItemRow[],
  now: Date,
): TakeStateResponse {
  const { row, share, attempt } = taking;
  const active = attempt.status === 'active';
  return {
    kind: share.kind === 'exam' ? 'exam' : 'practice',
    name: row.name,
    presenter: share.policy.presenter,
    status: attempt.status,
    total: attempt.total,
    answered: items.filter((item) => item.chosen !== null).length,
    position: attempt.position,
    secondsLeft: active ? secondsLeft(timingOf(attempt), null, now) : null,
    allowed: {
      navigation: navigationOf(share),
      flag: true,
      feedbackEachQuestion: feedbackEachQuestion(share),
    },
    items: items.map((item) => ({
      position: item.position,
      answered: item.chosen !== null,
      flagged: item.flagged,
    })),
  };
}

const NOTHING_YET: TakeResultResponse = {
  status: 'active',
  endedBy: null,
  level: 'none',
  moreAt: null,
  score: null,
  items: null,
};

/** A handed-in attempt: the policy's level once its time has come, and when more will show. */
export function resultView(
  taking: Taking,
  items: readonly AttemptItemRow[],
  now: Date,
): TakeResultResponse {
  const { share, attempt } = taking;
  if (attempt.status === 'active' || !attempt.submitted_at) return NOTHING_YET;
  const { level, moreAt } = revealNow(share, attempt.submitted_at, now);
  const explained = reveals(level, 'explained');
  return {
    status: 'submitted',
    endedBy: attempt.ended_by,
    level,
    moreAt: moreAt?.toISOString() ?? null,
    score: reveals(level, 'score')
      ? scoreOf(attempt.correct ?? 0, attempt.total, share.policy.content.passPercent)
      : null,
    items: reveals(level, 'answers')
      ? items.map((item) => ({
          position: item.position,
          stem: snapshotIn(item).stem,
          chosen: item.chosen ?? [],
          correct: item.correct === true,
          answers: snapshotIn(item).answers,
          explanation: explained ? snapshotIn(item).explanation : null,
        }))
      : null,
  };
}
