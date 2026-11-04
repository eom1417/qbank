import type { Clock } from '../../../platform/clock.js';
import type { BlobStore } from '../../../platform/storage/blob-store.js';
import type { RestoredLibrary, RestoreMaps } from '../../library/use-cases/portability.js';
import type { Questions } from '../../questions/index.js';
import type { PortableSource } from '../../sources/use-cases/portability.js';

/**
 * What export, restore and deletion use, each through its owner's public interface (M13):
 * the library's banks and taxonomy, the sources, the questions, study's sessions and the files.
 */
export interface PortabilityDeps {
  library: {
    findBank(
      ownerId: string,
      bankId: string,
    ): Promise<
      { id: string; name: string; description: string | null; subject: string | null } | undefined
    >;
    chaptersOf(
      ownerId: string,
      bankId: string,
    ): Promise<
      readonly { id: string; name: string; topics: readonly { id: string; name: string }[] }[]
    >;
    tagsOf(ownerId: string): Promise<readonly { id: string; name: string }[]>;
    bankIdsOf(ownerId: string): Promise<string[]>;
    restoreLibrary(ownerId: string, input: RestoredLibrary): Promise<RestoreMaps>;
    deleteBank(ownerId: string, bankId: string): Promise<boolean>;
  };
  sources: {
    sourcesOfBank(ownerId: string, bankId: string): Promise<PortableSource[]>;
    originalsOfBank(ownerId: string, bankId: string): Promise<string[]>;
    restoreSources(
      ownerId: string,
      bankId: string,
      sources: readonly PortableSource[],
    ): Promise<Map<string, string>>;
  };
  questions: Pick<
    Questions,
    'questionsOfBank' | 'extrasOf' | 'bankFootprint' | 'restoreQuestions' | 'statusCounts'
  >;
  study: {
    sessionsTouching(
      ownerId: string,
      questionIds: readonly string[],
    ): Promise<{ sessions: number; active: number }>;
    forgetQuestions(ownerId: string, questionIds: readonly string[]): Promise<void>;
  };
  deleteAccount(accountId: string): Promise<boolean>;
  blobs: BlobStore;
  clock: Clock;
  maxUploadBytes: number;
  /** How this install runs, for the support report. */
  mode: string;
}
