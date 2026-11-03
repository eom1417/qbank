import type { Clock } from '../../../platform/clock.js';
import type { BlobStore } from '../../../platform/storage/blob-store.js';
import type { Ai } from '../../ai/index.js';
import type { Questions } from '../../questions/index.js';
import type { ImportRepository } from '../adapters/import-repository.js';

export interface SourcesDeps {
  imports: ImportRepository;
  blobs: BlobStore;
  questions: Questions;
  /** The user's own AI connections (opened only for their own jobs). */
  ai: Pick<Ai, 'openOwned' | 'estimateFor'>;
  clock: Clock;
  newId: () => string;
  maxUploadBytes: number;
  maxPages: number;
}
