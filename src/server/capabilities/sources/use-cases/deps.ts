import type { Clock } from '../../../platform/clock.js';
import type { BlobStore } from '../../../platform/storage/blob-store.js';
import type { ImportAi } from '../../providers/index.js';
import type { Questions } from '../../questions/index.js';
import type { ImportRepository } from '../adapters/import-repository.js';

export interface SourcesDeps {
  /** Why a job failed, for the owner's log (M17.3): codes and the error, never page text. */
  log: { error(details: object, message: string): void };
  imports: ImportRepository;
  blobs: BlobStore;
  questions: Questions;
  /** Whether the bank is the account's (from the library): another's is the neutral not-found. */
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  /** The user's own AI connections (opened only for their own jobs). */
  ai: ImportAi;
  clock: Clock;
  /** Whether a source link opens (a study note never shows a dead link, DEC-34). */
  checkLink(url: string): Promise<boolean>;
  newId: () => string;
  maxUploadBytes: number;
  maxPages: number;
  /** The sample bank's PDF, imported in one click by a new owner (M28.1). */
  samplePdf: string;
  /** How long an original stays after its import ends, unless the user deletes it first. */
  originalRetentionMs: number;
  /** Imports running at once across accounts, never two for one account (M31, B2). */
  workers: number;
}
