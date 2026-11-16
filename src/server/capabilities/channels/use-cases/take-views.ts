import type {
  TakeItemResponse,
  TakeResultResponse,
  TakeStateResponse,
} from '../../../../contracts/take.js';
import {
  isCorrect,
  picturesBeforeReveal,
  picturesWithExplanation,
  secondsLeft,
  type Snapshot,
} from '../../exam-rules/index.js';
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

/** The explanation's pictures where the explanation itself shows (M34); none elsewhere. */
const explanationPictures = (snapshot: Snapshot, explained: boolean) =>
  explained ? picturesWithExplanation(snapshot) : [];

/** Practice with an immediate reveal: the answer once the question is answered. */
function feedbackOf(share: ShareState, item: AttemptItemRow) {
  if (!feedbackEachQuestion(share) || item.chosen === null) return null;
  const snapshot = snapshotIn(item);
  const explained = reveals(share.policy.reveal.level, 'explained');
  return {
    correct: isCorrect(item.chosen, snapshot.answers),
    answers: snapshot.answers,
    explanation: explained ? snapshot.explanation : null,
    pictureIds: explanationPictures(snapshot, explained),
  };
}

/** The level a handed-in attempt's result shows now; nothing while it is under way. */
function resultLevel({ share, attempt }: Taking, now: Date) {
  if (attempt.status === 'active' || !attempt.submitted_at) return null;
  return revealNow(share, attempt.submitted_at, now);
}

/** Whether this item's explanation shows now: in its feedback, or in the attempt's result. */
export function explainedNow(taking: Taking, item: AttemptItemRow, now: Date): boolean {
  const { share } = taking;
  const answered = feedbackEachQuestion(share) && item.chosen !== null;
  if (answered && reveals(share.policy.reveal.level, 'explained')) return true;
  const result = resultLevel(taking, now);
  return result !== null && reveals(result.level, 'explained');
}

/** The pictures a share shows with the question, before any reveal (M34, Q65). */
function questionPictures(snapshot: Snapshot) {
  const shown = picturesBeforeReveal(snapshot, 'shared');
  return {
    pictureIds: shown.pictureIds,
    optionPictureIds: shown.optionPictureIds,
    case: shown.case && { text: shown.case.text, pictures: shown.case.pictureIds },
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
    ...questionPictures(snapshot),
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
  const result = resultLevel(taking, now);
  if (!result) return NOTHING_YET;
  const { level, moreAt } = result;
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
          pictureIds: explanationPictures(snapshotIn(item), explained),
        }))
      : null,
  };
}
