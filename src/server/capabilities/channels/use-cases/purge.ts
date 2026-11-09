import type { ChannelsDeps } from './deps.js';
import { shareOf } from './governance.js';

const DAY_MS = 86_400_000;

/**
 * The retention purge (DEC-39): every share's recipients' answers and people's attempts older
 * than the days its policy keeps them go (an attempt counts from its hand-in, or its start when
 * never handed in). What left the bank (batches, the ledger) stays. One `records_purged` event
 * per share that lost something. Returns how many shares were purged.
 */
export async function purgeExpired(
  deps: Pick<ChannelsDeps, 'shares' | 'ledger'>,
  now: Date,
): Promise<number> {
  let purged = 0;
  for (const row of await deps.shares.everyShare()) {
    const days = shareOf(row).policy.records.retentionDays;
    const counts = await deps.shares.purgeOlder(row.id, new Date(now.getTime() - days * DAY_MS));
    if (counts.answers + counts.attempts === 0) continue;
    purged += 1;
    await deps.ledger.record({
      channelId: row.id,
      ownerId: row.owner_id,
      type: 'records_purged',
      version: row.version,
      detail: { ...counts, retentionDays: days },
    });
  }
  return purged;
}
