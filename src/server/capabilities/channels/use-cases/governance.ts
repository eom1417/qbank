import {
  DEFAULT_POLICIES,
  SharePolicy,
  type ShareKind,
  type ShareStatus,
} from '../../../../contracts/sharing.js';
import { AppError } from '../../../platform/errors/index.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import {
  gate,
  statusOf,
  type GateAction,
  type GateUsage,
  type ShareState,
} from '../domain/policy.js';
import type { ChannelsDeps } from './deps.js';

/**
 * A channel row as a governed share (DEC-39): its kind's default policy, the stored policy
 * over it, and the columns that stay the truth for what they hold (chapters, size, whenDone).
 * A row stored before M30 (policy `{}`) reads exactly as the channel behaved then.
 */
export function shareOf(row: ChannelRow): ShareState & { policy: SharePolicy } {
  const kind = row.kind as ShareKind;
  const base = DEFAULT_POLICIES[kind];
  const stored = (row.policy ?? {}) as Partial<SharePolicy>;
  const merged = {
    ...base,
    ...stored,
    content: {
      ...base.content,
      ...stored.content,
      chapterIds: row.chapter_ids,
      size: row.batch_size,
      whenDone: row.when_done,
    },
  };
  const parsed = SharePolicy.safeParse(merged);
  return {
    kind,
    policy: parsed.success ? parsed.data : base,
    paused: row.paused,
    endedAt: row.ended_at,
    archivedAt: row.archived_at,
  };
}

export const shareStatus = (row: ChannelRow, now: Date): ShareStatus => statusOf(shareOf(row), now);

/** Asks the gate and turns a refusal into its error. Every transport calls this, nothing else. */
export function enforce(
  deps: Pick<ChannelsDeps, 'clock'>,
  row: ChannelRow,
  action: GateAction,
  usage?: GateUsage,
) {
  const share = shareOf(row);
  const decision = gate(share, action, deps.clock.now(), usage);
  if (!decision.ok) throw new AppError(decision.code);
  return share;
}
