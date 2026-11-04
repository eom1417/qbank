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
import { createInsights } from './adapters/insights.js';
import { createPortability, type RestoredQuestion } from './adapters/portability.js';
import { searchQuestions, type SearchFilter } from './adapters/search.js';
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

export type { PoolQuestion } from './adapters/study-pool.js';
export type { RestoredQuestion } from './adapters/portability.js';
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

/** The repositories and lookups every questions use case receives. */
function questionDeps(settings: QuestionsSettings) {
  return {
    questions: createQuestionRepository(settings.db, newId, settings),
    media: createMediaRepository(settings.db, newId),
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
}

type Deps = ReturnType<typeof questionDeps>;

/** What study, analytics and portability read and write through (M9–M13). */
function sharedInterface(settings: QuestionsSettings, deps: Deps) {
  const portability = createPortability(settings.db, newId);
  return {
    /** The owner's eligible questions in a study scope, ready to snapshot (M9). */
    studyPool: (ownerId: string, filter: PoolFilter) => studyPool(settings.db, ownerId, filter),
    marksOf: createMarkRepository(settings.db).marksOf,
    ...createInsights(settings.db),
    questionsOfBank: portability.questionsOfBank,
    extrasOf: portability.extrasOf,
    bankFootprint: portability.bankFootprint,
    /** Restored questions, then the duplicates they bring into the bank (FR-18-005). */
    restoreQuestions: async (
      owner: { ownerId: string; bankId: string; now: Date },
      questions: readonly RestoredQuestion[],
    ) => {
      const added = await portability.restoreQuestions(owner, questions);
      await detectDuplicates(deps, owner, added, owner.now);
      return added.length;
    },
    /** The owner's questions by words and filters (FR-17-001, UI-22). */
    searchQuestions: (ownerId: string, filter: SearchFilter) =>
      searchQuestions(settings.db, ownerId, filter),
  };
}

export function createQuestions(settings: QuestionsSettings) {
  const deps = questionDeps(settings);
  const marks = createMarkRepository(settings.db);
  /** An import's questions, then the duplicates they bring into the bank (M8.1). */
  const saveImported = async (place: Place, questions: readonly ImportedQuestion[], now: Date) => {
    const added = await deps.questions.saveImported(place, questions, now);
    await detectDuplicates(deps, place, added, now);
  };
  return {
    ...deps.questions,
    saveImported,
    ...sharedInterface(settings, deps),
    ...deps.media,
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
