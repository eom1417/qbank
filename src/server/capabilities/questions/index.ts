import type { Db } from '../../platform/db/index.js';
import { newId } from '../../platform/ids.js';
import { createQuestionRepository } from './adapters/question-repository.js';

export type { ImportedQuestion, ReviewReason } from './domain/imported.js';

/** Questions with their answer keys and provenance (M4 writes them; review and study follow). */
export function createQuestions(settings: { db: Db }) {
  return createQuestionRepository(settings.db, newId);
}

export type Questions = ReturnType<typeof createQuestions>;
