import type { TakeItemResponse, TakeResultResponse } from '../../../../contracts/take.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isCorrect, type Snapshot } from '../../exam-rules/index.js';
import type { AttemptRow, EndedBy } from '../adapters/attempt-repository.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import { bearerOf, hashOf } from '../adapters/keys.js';
import { choiceProblem, endingOf, lockOf, navigationOf } from '../domain/attempt.js';
import type { ShareState } from '../domain/policy.js';
import type { ChannelsDeps } from './deps.js';
import { enforce } from './governance.js';
import { itemView, resultView, stateView, type Taking } from './take-views.js';

/** Ends an attempt once, and records it in the share's ledger. */
async function finish(deps: ChannelsDeps, row: ChannelRow, attempt: AttemptRow, by: EndedBy) {
  const ended = await deps.attempts.finish(attempt.id, by, deps.clock.now());
  if (!ended) return deps.attempts.byId(attempt.id);
  await deps.ledger.record({
    channelId: row.id,
    ownerId: row.owner_id,
    type: 'attempt_submitted',
    version: ended.version,
    detail: { attemptId: ended.id, endedBy: by, correct: ended.correct, total: ended.total },
  });
  return ended;
}

/** An attempt whose time or share is over is handed in as it stands, on its next read. */
export async function settle(
  deps: ChannelsDeps,
  row: ChannelRow,
  share: ShareState,
  attempt: AttemptRow,
) {
  const by = endingOf(share, attempt, deps.clock.now());
  return by ? finish(deps, row, attempt, by) : attempt;
}

/** The attempt an attempt token opens, settled; its share archived (or links off) opens none. */
export async function takingOf(deps: ChannelsDeps, authorization: string | undefined) {
  const token = bearerOf(authorization, 'qba_');
  const found = token ? await deps.attempts.byTokenHash(hashOf(token)) : undefined;
  if (!found) throw new AppError('unauthenticated');
  const row = deps.linksEnabled
    ? await deps.channels.findOwned(found.owner_id, found.channel_id)
    : undefined;
  if (!row) throw notFound();
  const share = enforce(deps, row, 'view');
  return { row, share, attempt: await settle(deps, row, share, found) };
}

/** The attempt's items, and the one at `position` (any other position is not found). */
async function itemsWith(deps: ChannelsDeps, taking: Taking, position: string) {
  const items = await deps.attempts.itemsOf(taking.attempt.id);
  const item = /^\d{1,3}$/.test(position) ? items[Number(position)] : undefined;
  if (!item) throw notFound();
  return { items, item };
}

export async function attemptState(deps: ChannelsDeps, taking: Taking) {
  return stateView(taking, await deps.attempts.itemsOf(taking.attempt.id), deps.clock.now());
}

/** Opens a question; forward-only navigation refuses going back. */
export async function openItem(
  deps: ChannelsDeps,
  taking: Taking,
  position: string,
): Promise<TakeItemResponse> {
  const { item } = await itemsWith(deps, taking, position);
  const { attempt, share } = taking;
  const now = deps.clock.now();
  if (attempt.status !== 'active') return itemView(taking, item, now);
  if (navigationOf(share) === 'forward' && item.position < attempt.position)
    throw new AppError('question_locked');
  await deps.attempts.open(attempt.id, item.position, now);
  const moved = { ...taking, attempt: { ...attempt, position: item.position } };
  return itemView(moved, { ...item, opened_at: item.opened_at ?? now }, now);
}

/** An item that may still change now, under the share's gate; otherwise the reason. */
async function changeableItem(deps: ChannelsDeps, taking: Taking, position: string) {
  enforce(deps, taking.row, 'continue');
  const { item } = await itemsWith(deps, taking, position);
  const lock = lockOf(taking.share, taking.attempt, item, deps.clock.now());
  if (lock) throw new AppError(lock);
  return item;
}

/** Saves the person's choice for a question (graded on its snapshot, shown only if allowed). */
export async function chooseItem(
  deps: ChannelsDeps,
  taking: Taking,
  position: string,
  chosenLetters: string[],
): Promise<TakeItemResponse> {
  const item = await changeableItem(deps, taking, position);
  const snapshot = item.snapshot as Snapshot;
  const problem = choiceProblem(snapshot, chosenLetters);
  if (problem) throw new AppError('validation_failed', { chosen: problem });
  const now = deps.clock.now();
  const chosen = [...new Set(chosenLetters)].sort();
  const answer = { chosen, correct: isCorrect(chosen, snapshot.answers), now };
  if (!(await deps.attempts.choose(taking.attempt.id, item.position, answer)))
    throw new AppError('exam_ended');
  return itemView(taking, { ...item, chosen, correct: answer.correct, answered_at: now }, now);
}

export async function flagItem(
  deps: ChannelsDeps,
  taking: Taking,
  position: string,
  flagged: boolean,
): Promise<TakeItemResponse> {
  enforce(deps, taking.row, 'continue');
  const { item } = await itemsWith(deps, taking, position);
  const { attempt, share } = taking;
  if (attempt.status !== 'active') throw new AppError('exam_ended');
  if (navigationOf(share) === 'forward' && item.position < attempt.position)
    throw new AppError('question_locked');
  await deps.attempts.flag(attempt.id, item.position, flagged);
  return itemView(taking, { ...item, flagged }, deps.clock.now());
}

export async function attemptResult(deps: ChannelsDeps, taking: Taking) {
  return resultView(taking, await deps.attempts.itemsOf(taking.attempt.id), deps.clock.now());
}

/** Hands the attempt in (again: the same result), graded on its snapshots. */
export async function submitAttempt(
  deps: ChannelsDeps,
  taking: Taking,
): Promise<TakeResultResponse> {
  enforce(deps, taking.row, 'submit');
  const attempt =
    taking.attempt.status === 'active'
      ? await finish(deps, taking.row, taking.attempt, 'person')
      : taking.attempt;
  return attemptResult(deps, { ...taking, attempt });
}

/** A picture of a question this attempt asks; any other picture is not found. */
export async function attemptPicture(deps: ChannelsDeps, taking: Taking, mediaId: string) {
  const items = await deps.attempts.itemsOf(taking.attempt.id);
  const asked = items.some((item) => (item.snapshot as Snapshot).pictureIds.includes(mediaId));
  const media = asked ? await deps.questions.findMedia(taking.attempt.owner_id, mediaId) : null;
  if (!media) throw notFound();
  return deps.pathOf(media.blob_key);
}
