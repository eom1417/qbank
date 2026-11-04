import type { Clock } from '../../../platform/clock.js';
import type { BlobStore } from '../../../platform/storage/blob-store.js';
import type { ImportAi } from '../../providers/index.js';
import type { Questions } from '../../questions/index.js';
import type { ImportRepository } from '../adapters/import-repository.js';

export interface SourcesDeps {
  imports: ImportRepository;
  blobs: BlobStore;
  questions: Questions;
  /** Whether the bank is the account's (from the library): another's is the neutral not-found. */
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  /** The user's own AI connections (opened only for their own jobs). */
  ai: ImportAi;
  clock: Clock;
  newId: () => string;
  maxUploadBytes: number;
  maxPages: number;
  /** How long an original stays after its import ends, unless the user deletes it first. */
  originalRetentionMs: number;
}
