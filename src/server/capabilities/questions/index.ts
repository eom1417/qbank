import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import type { RequireActor } from '../identity/index.js';
import { registerQuestionRoutes } from './http/routes.js';
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
}

export function createQuestions(settings: QuestionsSettings) {
  const repository = createQuestionRepository(settings.db, newId, settings);
  const deps = { questions: repository, clock: settings.clock };
  return {
    ...repository,
    ...createMediaRepository(settings.db, newId),
    register: (app: FastifyInstance) => registerQuestionRoutes(app, deps, settings.requireActor),
  };
}

export type Questions = ReturnType<typeof createQuestions>;
