import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import type { RequireActor } from '../identity/index.js';
import { registerQuestionRoutes } from './http/routes.js';
import { registerEditRoutes } from './http/edit-routes.js';
import { registerNoteRoutes } from './http/note-routes.js';
import { registerReviewRoutes } from './http/review-routes.js';
import { registerDuplicateRoutes } from './http/duplicate-routes.js';
import { registerMarkRoutes } from './http/mark-routes.js';
import { createPairRepository } from './adapters/pair-repository.js';
import { createMarkRepository, studyPool, type PoolFilter } from './adapters/study-pool.js';
import { detectDuplicates } from './use-cases/duplicates.js';
import type { ImportedQuestion } from './domain/imported.js';
import type { Place } from './adapters/question-writes.js';
import { createNoteRepository } from './adapters/note-repository.js';
import { createReportRepository } from './adapters/report-repository.js';
import { createReviewRepository } from './adapters/review-repository.js';
import { newId } from '../../platform/ids.js';
import { createMediaRepository } from './adapters/media-repository.js';
import { createQuestionRepository } from './adapters/question-repository.js';
import type { ChapterNames } from './domain/classify.js';

export type { PoolFilter, PoolQuestion } from './adapters/study-pool.js';
export {
  occurrencesOf,
  type ImportedMedia,
  type ImportedQuestion,
  type ReviewReason,
} from './domain/imported.js';

/** Questions with their answer keys, provenance and pictures (M4, M5; review and study follow). */
interface QuestionsSettings {
  db: Db;
  clock: Clock;
  requireActor: RequireActor;
  /** The bank's chapters and topics, from the library, to suggest a place (FR-08-002). */
  chaptersOf(ownerId: string, bankId: string): Promise<readonly ChapterNames[]>;
  /** The account's tags, from the library, to suggest tags (FR-11-004). */
  tagsOf(ownerId: string): Promise<readonly { id: string; name: string }[]>;
  /** Whether the bank is the account's, from the library (review lists are per bank). */
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  /** Removes a stored picture's file when its question is deleted for good. */
  deleteBlob(key: string): Promise<void>;
}

export function createQuestions(settings: QuestionsSettings) {
  const repository = createQuestionRepository(settings.db, newId, settings);
  const media = createMediaRepository(settings.db, newId);
  const deps = {
    questions: repository,
    media,
    clock: settings.clock,
    review: createReviewRepository(settings.db),
    notes: createNoteRepository(settings.db),
    reports: createReportRepository(settings.db),
    pairs: createPairRepository(settings.db, newId),
    newId,
    deleteBlob: settings.deleteBlob,
    ownsBank: settings.ownsBank,
    chaptersOf: settings.chaptersOf,
    tagsOf: settings.tagsOf,
  };
  /** An import's questions, then the duplicates they bring into the bank (M8.1). */
  const saveImported = async (place: Place, questions: readonly ImportedQuestion[], now: Date) => {
    const added = await repository.saveImported(place, questions, now);
    await detectDuplicates(deps, place, added, now);
  };
  const marks = createMarkRepository(settings.db);
  return {
    ...repository,
    saveImported,
    /** The owner's eligible questions in a study scope, ready to snapshot (M9). */
    studyPool: (ownerId: string, filter: PoolFilter) => studyPool(settings.db, ownerId, filter),
    marksOf: marks.marksOf,
    ...media,
    register: (app: FastifyInstance) => {
      registerQuestionRoutes(app, deps, settings.requireActor);
      registerReviewRoutes(app, deps, settings.requireActor);
      registerEditRoutes(app, deps, settings.requireActor);
      registerNoteRoutes(app, deps, settings.requireActor);
      registerDuplicateRoutes(app, deps, settings.requireActor);
      registerMarkRoutes(app, { ...deps, marks }, settings.requireActor);
    },
  };
}

export type Questions = ReturnType<typeof createQuestions>;
