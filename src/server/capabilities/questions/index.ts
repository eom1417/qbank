import type { Db } from '../../platform/db/index.js';
import { newId } from '../../platform/ids.js';
import { createMediaRepository } from './adapters/media-repository.js';
import { createQuestionRepository } from './adapters/question-repository.js';

export type { ImportedMedia, ImportedQuestion, ReviewReason } from './domain/imported.js';

/** Questions with their answer keys, provenance and pictures (M4, M5; review and study follow). */
export function createQuestions(settings: { db: Db }) {
  return {
    ...createQuestionRepository(settings.db, newId),
    ...createMediaRepository(settings.db, newId),
  };
}

export type Questions = ReturnType<typeof createQuestions>;
