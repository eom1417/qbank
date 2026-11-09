import { sql } from 'kysely';
import type { z } from 'zod';
import {
  policyIssues,
  type CreateShareRequest,
  type ShareKind,
  type SharePolicy,
  type ShareSecretResponse,
  type ShareView,
  type UpdateShareRequest,
} from '../../../../contracts/sharing.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import { newSecret } from '../adapters/keys.js';
import { attemptSize } from '../domain/attempt-draw.js';
import type { ChannelsDeps } from './deps.js';
import { shareOf } from './governance.js';
import { ownedBank, ownedChannel } from './manage.js';
import { secretResponse, viewOf } from './shares-view.js';

/** The policy as stored: what to send in the columns that hold it, the rest in `policy`. */
function policyColumns(policy: SharePolicy) {
  const { chapterIds, size, whenDone, ...content } = policy.content;
  return {
    chapter_ids: chapterIds,
    batch_size: size,
    when_done: whenDone,
    policy: JSON.stringify({ ...policy, content }),
  };
}

/**
 * The scope must hold what the share promises: the fixed questions are ready questions of the
 * bank, and an exam or practice has enough different ready questions for a whole attempt, so a
 * published link never fails when a person presses start.
 */
async function checkScope(
  deps: ChannelsDeps,
  ownerId: string,
  bankId: string,
  share: { kind: ShareKind; policy: SharePolicy },
) {
  const { content } = share.policy;
  const pool = await deps.questions.studyPool(ownerId, { bankIds: [bankId] });
  const ready = new Set(pool.map((q) => q.id));
  if (content.fixedQuestionIds.some((id) => !ready.has(id)))
    throw new AppError('validation_failed', { 'policy.content.fixedQuestionIds': 'not_ready' });
  if (share.kind === 'agent') return;
  const chapters = new Set(content.chapterIds);
  const inScope = pool.filter(
    (q) =>
      chapters.size === 0 ||
      (q.chapterId !== null && chapters.has(q.chapterId)) ||
      content.fixedQuestionIds.includes(q.id),
  );
  if (new Set(inScope.map((q) => q.exactKey)).size < attemptSize(content))
    throw new AppError('not_enough_questions');
}

/** A new secret for a share of the kind: an agent's key or a person's link token. */
export const shareSecret = (kind: ShareKind) => newSecret(kind === 'agent' ? 'qbc_' : 'qbt_');

/** The account's share, still under its owner's control: an archived one only goes away. */
export async function liveShare(deps: ChannelsDeps, actor: Actor, id: string) {
  const row = await ownedChannel(deps, actor, id);
  if (row.archived_at) throw new AppError('share_ended');
  return row;
}

/** Saves the owner's change and returns the share as it is now. */
export async function changed(deps: ChannelsDeps, actor: Actor, id: string, patch: object) {
  const row = await deps.channels.update(actor.accountId, id, patch as Record<string, unknown>);
  if (!row) throw notFound();
  return row;
}

/** A new share of the bank (DEC-39); its secret (key or link) is shown in this answer only. */
export async function createShare(
  deps: ChannelsDeps,
  actor: Actor,
  bankId: string,
  input: CreateShareRequest,
): Promise<ShareSecretResponse> {
  await ownedBank(deps, actor, bankId);
  if (input.kind !== 'agent' && !deps.linksEnabled) throw new AppError('links_unavailable');
  await checkScope(deps, actor.accountId, bankId, input);
  const secret = shareSecret(input.kind);
  const id = deps.newId();
  await deps.channels.insert({
    id,
    owner_id: actor.accountId,
    bank_id: bankId,
    kind: input.kind,
    name: input.name,
    ...policyColumns(input.policy),
    key_hash: secret.hash,
    key_prefix: secret.prefix,
    created_at: deps.clock.now(),
  });
  const row = await ownedChannel(deps, actor, id);
  await deps.ledger.record({
    channelId: id,
    ownerId: actor.accountId,
    type: 'created',
    version: row.version,
    detail: { kind: input.kind },
  });
  return secretResponse(deps, row, secret.secret);
}

const SECTIONS = ['presenter', 'content', 'audience', 'limits', 'reveal', 'records'] as const;

/** Which of the policy's six parts differ. */
const changedSections = (before: SharePolicy, after: SharePolicy) =>
  SECTIONS.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));

/** A new policy: checked for its kind, then a new version (attempts under way keep theirs). */
async function changePolicy(
  deps: ChannelsDeps,
  actor: Actor,
  row: ChannelRow,
  policy: SharePolicy,
) {
  const share = shareOf(row);
  const issues = policyIssues(share.kind, policy);
  if (issues.length > 0)
    throw new AppError(
      'validation_failed',
      Object.fromEntries(issues.map((issue) => [issue.path.join('.'), issue.message])),
    );
  await checkScope(deps, actor.accountId, row.bank_id, { kind: share.kind, policy });
  const sections = changedSections(share.policy, policy);
  if (sections.length === 0) return row;
  const updated = await changed(deps, actor, row.id, {
    ...policyColumns(policy),
    version: sql`version + 1`,
  });
  await deps.ledger.record({
    channelId: row.id,
    ownerId: actor.accountId,
    type: 'policy_changed',
    version: updated.version,
    detail: { sections: sections.join(','), from: row.version },
  });
  return updated;
}

/** `PATCH /api/shares/:id`: a new name, a new policy, or both. */
export async function updateShare(
  deps: ChannelsDeps,
  actor: Actor,
  id: string,
  input: z.infer<typeof UpdateShareRequest>,
): Promise<ShareView> {
  let row = await liveShare(deps, actor, id);
  if (input.name !== undefined && input.name !== row.name) {
    row = await changed(deps, actor, id, { name: input.name });
    await deps.ledger.record({
      channelId: id,
      ownerId: actor.accountId,
      type: 'renamed',
      version: row.version,
    });
  }
  if (input.policy) row = await changePolicy(deps, actor, row, input.policy);
  return viewOf(deps, row);
}
