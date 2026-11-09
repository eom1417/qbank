import type {
  BatchAnswersResponse,
  BatchResponse,
  ChannelAnswerResponse,
  ChannelStats,
} from '../../../../contracts/channels.js';
import { isCorrect } from '../../exam-rules/index.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import { hashOf, keyIn } from '../adapters/keys.js';
import { revealNow, reveals } from '../domain/policy.js';
import { pickBatch } from '../domain/selection.js';
import type { ChannelsDeps } from './deps.js';
import { enforce } from './governance.js';
import { channelStats, readyQuestions } from './manage.js';

type Ready = Awaited<ReturnType<typeof readyQuestions>>[number];

/** The channel a key opens; a missing, malformed or replaced key opens none. */
export async function channelOfKey(deps: ChannelsDeps, authorization: string | undefined) {
  const key = keyIn(authorization);
  const row = key ? await deps.channels.findByKeyHash(hashOf(key)) : undefined;
  if (row?.kind !== 'agent') throw new AppError('unauthenticated');
  enforce(deps, row, 'view');
  return row;
}

/** A question as it goes out: never its answer; its pictures through the channel's route. */
const outgoing = (question: Ready, deliveryId: string) => ({
  deliveryId,
  questionId: question.id,
  stem: question.stem,
  options: question.options.map((o) => ({ letter: o.letter, text: o.text })),
  multiSelect: question.multiSelect,
  pictures: question.pictureIds.map((id) => `/api/channel/v1/pictures/${id}`),
});

/** A saved batch as the agent sees it, from its deliveries (asking again with the same key). */
async function batchView(deps: ChannelsDeps, row: ChannelRow, batchId: string, done: boolean) {
  const batch = await deps.channels.batchById(row.id, batchId);
  if (!batch) throw notFound();
  const deliveries = await deps.channels.deliveriesOf(batch.id);
  const ready = new Map((await readyQuestions(deps, row)).map((q) => [q.id, q]));
  const questions = deliveries.flatMap((d) => {
    const question = ready.get(d.question_id);
    return question ? [outgoing(question, d.id)] : [];
  });
  return {
    id: batch.id,
    cycle: batch.cycle,
    createdAt: batch.created_at.toISOString(),
    questions,
    done,
  };
}

/** The first moment of the UTC day `now` is in: a share's daily limit counts from it. */
const dayOf = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

type Tx = Parameters<Parameters<ChannelsDeps['channels']['locked']>[1]>[0];

/** Chooses and saves a new batch with the channel row held; the gate counts today's first. */
async function drawBatch(
  deps: ChannelsDeps,
  tx: Tx,
  row: ChannelRow,
  ready: readonly string[],
  key: string | undefined,
) {
  const current = (await tx.findOwned(row.owner_id, row.id)) ?? row;
  const now = deps.clock.now();
  enforce(deps, current, 'open', {
    batchesToday: await deps.shares.batchesSince(row.id, dayOf(now)),
  });
  const pick = pickBatch({
    ready,
    sent: new Set(await tx.sentInCycle(row.id, current.cycle)),
    cycle: current.cycle,
    size: current.batch_size,
    whenDone: current.when_done,
  });
  const batchId = deps.newId();
  const deliveries = pick.questionIds.map((questionId) => ({ id: deps.newId(), questionId }));
  const batch = { id: batchId, channelId: row.id, ownerId: row.owner_id, key: key ?? null };
  await tx.saveBatch({ ...batch, cycle: pick.cycle, now, deliveries });
  return { batchId, done: pick.done || deliveries.length === 0, sent: deliveries.length };
}

/**
 * The channel's next batch (DEC-36): questions this cycle has not sent, at random, one batch
 * at a time (the channel row is held while it is chosen). The same `key` returns the same batch,
 * which is only reading what was already given; a new batch is something new leaving (DEC-39).
 */
export async function nextBatch(
  deps: ChannelsDeps,
  row: ChannelRow,
  key: string | undefined,
): Promise<BatchResponse> {
  const again = key ? await deps.channels.batchByKey(row.id, key) : undefined;
  if (again) {
    enforce(deps, row, 'view');
    return batchView(deps, row, again.id, false);
  }
  enforce(deps, row, 'open');
  const ready = (await readyQuestions(deps, row)).map((q) => q.id);
  const result = await deps.channels.locked(row.id, async (tx) => {
    const raced = key ? await tx.batchByKey(row.id, key) : undefined;
    if (raced) return { batchId: raced.id, done: false, sent: 0 };
    return drawBatch(deps, tx, row, ready, key);
  });
  if (result.sent > 0)
    await deps.ledger.record({
      channelId: row.id,
      ownerId: row.owner_id,
      type: 'batch_sent',
      version: row.version,
      detail: { questions: result.sent },
    });
  return batchView(deps, row, result.batchId, result.done);
}

/** What the share's reveal allows now for something sent at `sentAt` (DEC-39). */
function revealedLevel(deps: ChannelsDeps, row: ChannelRow, sentAt: Date) {
  const share = enforce(deps, row, 'view');
  return revealNow(share, sentAt, deps.clock.now()).level;
}

type Found = Awaited<ReturnType<ChannelsDeps['questions']['findQuestion']>>;
type Note = Awaited<ReturnType<ChannelsDeps['questions']['studyNoteOf']>>;

/** The book's explanation and the AI's topic note, when the reveal includes them. */
const explanationOf = (question: Found, note: Note) => ({
  explanation: question?.explanation ?? null,
  topic: note?.topic ?? null,
  keyIdea: note?.keyIdea || null,
});
const HIDDEN = { explanation: null, topic: null, keyIdea: null };

/**
 * The answers of a batch, with the book's explanation and the AI's topic note when there is one,
 * once the share's reveal is due (at once by default).
 */
export async function batchAnswers(
  deps: ChannelsDeps,
  row: ChannelRow,
  batchId: string,
): Promise<BatchAnswersResponse> {
  const batch = isId(batchId) ? await deps.channels.batchById(row.id, batchId) : undefined;
  if (!batch) throw notFound();
  const level = revealedLevel(deps, row, batch.created_at);
  if (level === 'none') throw new AppError('not_revealed_yet');
  const explained = reveals(level, 'explained');
  await deps.channels.touch(row.id, deps.clock.now());
  const deliveries = await deps.channels.deliveriesOf(batch.id);
  const answers = await Promise.all(
    deliveries.map(async (d) => {
      const question = await deps.questions.findQuestion(row.owner_id, d.question_id);
      const shown = explained
        ? explanationOf(question, await deps.questions.studyNoteOf(row.owner_id, d.question_id))
        : HIDDEN;
      return {
        deliveryId: d.id,
        questionId: d.question_id,
        answers: question?.answer_letters ?? [],
        ...shown,
      };
    }),
  );
  return { id: batch.id, answers };
}

/**
 * One recipient's answer to a question the channel sent: kept in the channel alone, once. The
 * right answers come back only once the share's reveal is due.
 */
export async function recordAnswer(
  deps: ChannelsDeps,
  row: ChannelRow,
  input: { deliveryId: string; recipient: string; choice: string[] },
): Promise<ChannelAnswerResponse> {
  enforce(deps, row, 'continue');
  const delivery = await deps.channels.delivery(row.id, input.deliveryId);
  const question =
    delivery && (await deps.questions.findQuestion(row.owner_id, delivery.question_id));
  if (!delivery || !question) throw notFound();
  const answers = question.answer_letters;
  const correct = isCorrect(input.choice, answers);
  const saved = await deps.channels.saveAnswer({
    deliveryId: delivery.id,
    channelId: row.id,
    ownerId: row.owner_id,
    recipientHash: hashOf(`${row.id}:${input.recipient}`),
    choice: input.choice,
    correct,
    now: deps.clock.now(),
  });
  if (!saved) throw new AppError('already_answered');
  const due = revealedLevel(deps, row, delivery.sent_at) !== 'none';
  return { correct, answers: due ? answers : [] };
}

/** The channel's own numbers, for its agent: reading only. */
export function agentStats(deps: ChannelsDeps, row: ChannelRow): Promise<ChannelStats> {
  enforce(deps, row, 'view');
  return channelStats(deps, row);
}

/** A picture of a question this channel has sent; any other picture is not found. */
export async function channelPicture(deps: ChannelsDeps, row: ChannelRow, mediaId: string) {
  enforce(deps, row, 'view');
  const media = isId(mediaId) ? await deps.questions.findMedia(row.owner_id, mediaId) : null;
  if (!media?.question_id || !(await deps.channels.hasSent(row.id, media.question_id)))
    throw notFound();
  return deps.pathOf(media.blob_key);
}
