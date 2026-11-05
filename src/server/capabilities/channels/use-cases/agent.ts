import type {
  BatchAnswersResponse,
  BatchResponse,
  ChannelAnswerResponse,
} from '../../../../contracts/channels.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import { hashOf, keyIn } from '../adapters/keys.js';
import { isCorrect, pickBatch } from '../domain/selection.js';
import type { ChannelsDeps } from './deps.js';
import { readyQuestions } from './manage.js';

type Ready = Awaited<ReturnType<typeof readyQuestions>>[number];

/** The channel a key opens; a missing, malformed or replaced key opens none. */
export async function channelOfKey(deps: ChannelsDeps, authorization: string | undefined) {
  const key = keyIn(authorization);
  const row = key ? await deps.channels.findByKeyHash(hashOf(key)) : undefined;
  if (!row) throw new AppError('unauthenticated');
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

/**
 * The channel's next batch (DEC-36): questions this cycle has not sent, at random, one batch
 * at a time (the channel row is held while it is chosen). The same `key` returns the same batch.
 */
export async function nextBatch(
  deps: ChannelsDeps,
  row: ChannelRow,
  key: string | undefined,
): Promise<BatchResponse> {
  if (row.paused) throw new AppError('channel_paused');
  const ready = await readyQuestions(deps, row);
  const result = await deps.channels.locked(row.id, async (tx) => {
    const again = key ? await tx.batchByKey(row.id, key) : undefined;
    if (again) return { batchId: again.id, done: false };
    const current = (await tx.findOwned(row.owner_id, row.id)) ?? row;
    const pick = pickBatch({
      ready: ready.map((q) => q.id),
      sent: new Set(await tx.sentInCycle(row.id, current.cycle)),
      cycle: current.cycle,
      size: current.batch_size,
      whenDone: current.when_done,
    });
    const batchId = deps.newId();
    const deliveries = pick.questionIds.map((questionId) => ({ id: deps.newId(), questionId }));
    await tx.saveBatch({
      id: batchId,
      channelId: row.id,
      ownerId: row.owner_id,
      key: key ?? null,
      cycle: pick.cycle,
      now: deps.clock.now(),
      deliveries,
    });
    return { batchId, done: pick.done || pick.questionIds.length === 0 };
  });
  return batchView(deps, row, result.batchId, result.done);
}

/** The answers of a batch, with the book's explanation and the AI's topic note when there is one. */
export async function batchAnswers(
  deps: ChannelsDeps,
  row: ChannelRow,
  batchId: string,
): Promise<BatchAnswersResponse> {
  const batch = isId(batchId) ? await deps.channels.batchById(row.id, batchId) : undefined;
  if (!batch) throw notFound();
  await deps.channels.touch(row.id, deps.clock.now());
  const deliveries = await deps.channels.deliveriesOf(batch.id);
  const answers = await Promise.all(
    deliveries.map(async (d) => {
      const question = await deps.questions.findQuestion(row.owner_id, d.question_id);
      const note = await deps.questions.studyNoteOf(row.owner_id, d.question_id);
      return {
        deliveryId: d.id,
        questionId: d.question_id,
        answers: question?.answer_letters ?? [],
        explanation: question?.explanation ?? null,
        topic: note?.topic ?? null,
        keyIdea: note?.keyIdea || null,
      };
    }),
  );
  return { id: batch.id, answers };
}

/** One recipient's answer to a question the channel sent: kept in the channel alone, once. */
export async function recordAnswer(
  deps: ChannelsDeps,
  row: ChannelRow,
  input: { deliveryId: string; recipient: string; choice: string[] },
): Promise<ChannelAnswerResponse> {
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
  return { correct, answers };
}

/** A picture of a question this channel has sent; any other picture is not found. */
export async function channelPicture(deps: ChannelsDeps, row: ChannelRow, mediaId: string) {
  const media = isId(mediaId) ? await deps.questions.findMedia(row.owner_id, mediaId) : null;
  if (!media?.question_id || !(await deps.channels.hasSent(row.id, media.question_id)))
    throw notFound();
  return deps.pathOf(media.blob_key);
}
