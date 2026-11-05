import type {
  ChannelKeyResponse,
  ChannelSettings,
  ChannelStats,
  ChannelView,
} from '../../../../contracts/channels.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import { newChannelKey } from '../adapters/keys.js';
import type { ChannelsDeps } from './deps.js';

function toView(row: ChannelRow): ChannelView {
  return {
    id: row.id,
    bankId: row.bank_id,
    name: row.name,
    chapterIds: row.chapter_ids,
    batchSize: row.batch_size,
    whenDone: row.when_done,
    keyPrefix: row.key_prefix,
    paused: row.paused,
    cycle: row.cycle,
    createdAt: row.created_at.toISOString(),
    lastUsedAt: row.last_used_at?.toISOString() ?? null,
  };
}

/** The account's channel, or not found (another account's looks the same as none). */
export async function ownedChannel(deps: ChannelsDeps, actor: Actor, id: string) {
  const row = isId(id) ? await deps.channels.findOwned(actor.accountId, id) : undefined;
  if (!row) throw notFound();
  return row;
}

export async function listChannels(deps: ChannelsDeps, actor: Actor, bankId: string) {
  if (!isId(bankId) || !(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
  return { channels: (await deps.channels.listOfBank(actor.accountId, bankId)).map(toView) };
}

export async function createChannel(
  deps: ChannelsDeps,
  actor: Actor,
  bankId: string,
  settings: ChannelSettings,
): Promise<ChannelKeyResponse> {
  if (!isId(bankId) || !(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
  const { key, hash, prefix } = newChannelKey();
  const id = deps.newId();
  await deps.channels.insert({
    id,
    owner_id: actor.accountId,
    bank_id: bankId,
    name: settings.name,
    chapter_ids: settings.chapterIds,
    batch_size: settings.batchSize,
    when_done: settings.whenDone,
    key_hash: hash,
    key_prefix: prefix,
    created_at: deps.clock.now(),
  });
  return { channel: toView(await ownedChannel(deps, actor, id)), key };
}

type Update = { [K in keyof ChannelSettings]?: ChannelSettings[K] | undefined } & {
  paused?: boolean | undefined;
};

export async function updateChannel(deps: ChannelsDeps, actor: Actor, id: string, input: Update) {
  await ownedChannel(deps, actor, id);
  const patch = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.chapterIds !== undefined ? { chapter_ids: input.chapterIds } : {}),
    ...(input.batchSize !== undefined ? { batch_size: input.batchSize } : {}),
    ...(input.whenDone !== undefined ? { when_done: input.whenDone } : {}),
    ...(input.paused !== undefined ? { paused: input.paused } : {}),
  };
  if (Object.keys(patch).length === 0) return toView(await ownedChannel(deps, actor, id));
  const row = await deps.channels.update(actor.accountId, id, patch);
  if (!row) throw notFound();
  return toView(row);
}

/** A new key; the old one stops working at once. */
export async function renewKey(deps: ChannelsDeps, actor: Actor, id: string) {
  await ownedChannel(deps, actor, id);
  const { key, hash, prefix } = newChannelKey();
  const row = await deps.channels.update(actor.accountId, id, {
    key_hash: hash,
    key_prefix: prefix,
  });
  if (!row) throw notFound();
  return { channel: toView(row), key };
}

export async function removeChannel(deps: ChannelsDeps, actor: Actor, id: string) {
  if (!isId(id) || !(await deps.channels.remove(actor.accountId, id))) throw notFound();
}

/** The channel's own numbers, with the stems of the questions it sent. */
export async function channelStats(deps: ChannelsDeps, row: ChannelRow): Promise<ChannelStats> {
  const ready = await readyQuestions(deps, row);
  const stems = new Map(ready.map((q) => [q.id, q.stem]));
  const numbers = await deps.numbers(row.id, row.cycle);
  const questions = await Promise.all(
    numbers.questions.map(async (q) => {
      const stem =
        stems.get(q.questionId) ??
        (await deps.questions.findQuestion(row.owner_id, q.questionId))?.stem ??
        '';
      return { ...q, stem: stem.slice(0, 200) };
    }),
  );
  return { ...numbers, questions, cycle: row.cycle, ready: ready.length };
}

/** The bank's ready questions in the channel's chapters (all chapters when none are chosen). */
export const readyQuestions = (deps: ChannelsDeps, row: ChannelRow) =>
  deps.questions.studyPool(row.owner_id, {
    bankIds: [row.bank_id],
    ...(row.chapter_ids.length > 0 ? { chapterIds: row.chapter_ids } : {}),
  });
