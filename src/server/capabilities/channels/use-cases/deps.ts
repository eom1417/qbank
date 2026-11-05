import type { Clock } from '../../../platform/clock.js';
import type { Questions } from '../../questions/index.js';
import type { ChannelRepository } from '../adapters/channel-repository.js';
import type { channelNumbers } from '../adapters/channel-stats.js';

/**
 * What channels use (DEC-36): their own tables, and the questions only through the questions'
 * public interface, read-only. Nothing of study: a channel never sees or changes its owner's
 * progress, and study never sees a channel.
 */
export interface ChannelsDeps {
  channels: ChannelRepository;
  /** The channel's own counts (its tables only). */
  numbers(channelId: string, cycle: number): ReturnType<typeof channelNumbers>;
  questions: Pick<Questions, 'studyPool' | 'findQuestion' | 'findMedia' | 'studyNoteOf'>;
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  /** Where a stored picture's file is. */
  pathOf(blobKey: string): string;
  clock: Clock;
  newId(): string;
}
