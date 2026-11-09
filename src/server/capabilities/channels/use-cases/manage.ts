import type { ChannelStats } from '../../../../contracts/channels.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import type { ChannelsDeps } from './deps.js';
import { isReserved, reservedScopes } from './shares-scope.js';

/** The account's share, or not found (another account's looks the same as none). */
export async function ownedChannel(deps: ChannelsDeps, actor: Actor, id: string) {
  const row = isId(id) ? await deps.channels.findOwned(actor.accountId, id) : undefined;
  if (!row) throw notFound();
  return row;
}

/** Deletes the share and everything it recorded (cascade). */
export async function removeShare(deps: ChannelsDeps, actor: Actor, id: string) {
  if (!isId(id) || !(await deps.channels.remove(actor.accountId, id))) throw notFound();
}

/** Not found unless the bank is the account's (another account's looks the same as none). */
export async function ownedBank(deps: ChannelsDeps, actor: Actor, bankId: string) {
  if (!isId(bankId) || !(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
}

/**
 * The bank's ready questions in the share's chapters (all chapters when none are chosen). An
 * agent share skips what the bank's exam shares reserve (DEC-39); an exam or practice share
 * draws from all of them.
 */
export async function readyQuestions(deps: ChannelsDeps, row: ChannelRow) {
  const pool = await deps.questions.studyPool(row.owner_id, {
    bankIds: [row.bank_id],
    ...(row.chapter_ids.length > 0 ? { chapterIds: row.chapter_ids } : {}),
  });
  if (row.kind !== 'agent') return pool;
  const scopes = await reservedScopes(deps, row.owner_id, row.bank_id);
  return scopes.length === 0 ? pool : pool.filter((question) => !isReserved(scopes, question));
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
