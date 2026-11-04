import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import type { RequireActor } from '../identity/index.js';
import { registerQuestionRoutes } from './http/routes.js';
import { registerEditRoutes } from './http/edit-routes.js';
import { registerNoteRoutes } from './http/note-routes.js';
import { registerReviewRoutes } from './http/review-routes.js';
import { createNoteRepository } from './adapters/note-repository.js';
import { createReportRepository } from './adapters/report-repository.js';
import { createReviewRepository } from './adapters/review-repository.js';
import { newId } from '../../platform/ids.js';
import { createMediaRepository } from './adapters/media-repository.js';
import { createQuestionRepository } from './adapters/question-repository.js';
import type { ChapterNames } from './domain/classify.js';

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
    newId,
    deleteBlob: settings.deleteBlob,
    ownsBank: settings.ownsBank,
    chaptersOf: settings.chaptersOf,
    tagsOf: settings.tagsOf,
  };
  return {
    ...repository,
    ...media,
    register: (app: FastifyInstance) => {
      registerQuestionRoutes(app, deps, settings.requireActor);
      registerReviewRoutes(app, deps, settings.requireActor);
      registerEditRoutes(app, deps, settings.requireActor);
      registerNoteRoutes(app, deps, settings.requireActor);
    },
  };
}

export type Questions = ReturnType<typeof createQuestions>;
