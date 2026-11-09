import type { ChannelStats } from '../../../../contracts/channels.js';
import type {
  ShareEventType,
  ShareSecretResponse,
  ShareView,
} from '../../../../contracts/sharing.js';
import { notFound } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import type { ChannelsDeps } from './deps.js';
import { channelStats, ownedChannel } from './manage.js';
import { changed, liveShare, shareSecret } from './shares.js';
import { secretResponse, viewOf } from './shares-view.js';

/** The owner's controls over a share (DEC-39, question 6). */
export type Control = 'pause' | 'resume' | 'end' | 'archive';

interface ControlRule {
  /** Already in the state the control asks for: nothing to change, nothing to record. */
  done(row: ChannelRow): boolean;
  patch(now: Date): Record<string, unknown>;
  event: ShareEventType;
}

const CONTROLS: Record<Control, ControlRule> = {
  pause: { done: (row) => row.paused, patch: () => ({ paused: true }), event: 'paused' },
  resume: { done: (row) => !row.paused, patch: () => ({ paused: false }), event: 'resumed' },
  end: {
    done: (row) => row.ended_at !== null,
    patch: (now) => ({ ended_at: now }),
    event: 'ended',
  },
  archive: {
    done: (row) => row.archived_at !== null,
    patch: (now) => ({ archived_at: now }),
    event: 'archived',
  },
};

/** Pause, resume, end or archive; an archived share refuses all of them. */
export async function controlShare(
  deps: ChannelsDeps,
  actor: Actor,
  id: string,
  control: Control,
): Promise<ShareView> {
  const row = await liveShare(deps, actor, id);
  const rule = CONTROLS[control];
  if (rule.done(row)) return viewOf(deps, row);
  const updated = await changed(deps, actor, id, rule.patch(deps.clock.now()));
  await deps.ledger.record({
    channelId: id,
    ownerId: actor.accountId,
    type: rule.event,
    version: updated.version,
  });
  return viewOf(deps, updated);
}

/** A new key or link; the old one stops working at once. */
export async function renewSecret(
  deps: ChannelsDeps,
  actor: Actor,
  id: string,
): Promise<ShareSecretResponse> {
  const row = await liveShare(deps, actor, id);
  const secret = shareSecret(row.kind);
  const updated = await changed(deps, actor, id, {
    key_hash: secret.hash,
    key_prefix: secret.prefix,
  });
  await deps.ledger.record({
    channelId: id,
    ownerId: actor.accountId,
    type: 'secret_renewed',
    version: updated.version,
  });
  return secretResponse(deps, updated, secret.secret);
}

/** An agent share's own numbers; other kinds have their results instead. */
export async function shareStats(
  deps: ChannelsDeps,
  actor: Actor,
  id: string,
): Promise<ChannelStats> {
  const row = await ownedChannel(deps, actor, id);
  if (row.kind !== 'agent') throw notFound();
  return channelStats(deps, row);
}
