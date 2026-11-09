import type { Clock } from '../../../platform/clock.js';
import type { Questions } from '../../questions/index.js';
import type { AttemptRepository } from '../adapters/attempt-repository.js';
import type { ChannelRepository } from '../adapters/channel-repository.js';
import type { Ledger } from '../adapters/ledger.js';
import type { ShareQueries } from '../adapters/share-queries.js';
import type { channelNumbers } from '../adapters/channel-stats.js';

/**
 * What channels use (DEC-36): their own tables, and the questions only through the questions'
 * public interface, read-only. Nothing of study: a channel never sees or changes its owner's
 * progress, and study never sees a channel.
 */
export interface ChannelsDeps {
  channels: ChannelRepository;
  /** What the owner's sharing views and the retention purge read across shares (M30). */
  shares: ShareQueries;
  /** Exam/practice attempts (M30). */
  attempts: AttemptRepository;
  /** The append-only record and what has left the bank (DEC-39). */
  ledger: Ledger;
  /** Exam/practice links need a server people can reach: off in local mode (DEC-39). */
  linksEnabled: boolean;
  /** The channel's own counts (its tables only). */
  numbers(channelId: string, cycle: number): ReturnType<typeof channelNumbers>;
  questions: Pick<Questions, 'studyPool' | 'findQuestion' | 'findMedia' | 'studyNoteOf'>;
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  /** The bank's name for the owner's list of shares; null when it is not the owner's. */
  bankNameOf(ownerId: string, bankId: string): Promise<string | null>;
  /** Where a stored picture's file is. */
  pathOf(blobKey: string): string;
  clock: Clock;
  newId(): string;
}
