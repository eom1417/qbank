import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import { newId } from '../../platform/ids.js';
import type { BlobStore } from '../../platform/storage/blob-store.js';
import type { Ai } from '../ai/index.js';
import type { RequireActor } from '../identity/index.js';
import type { Questions } from '../questions/index.js';
import { createImportRepository } from './adapters/import-repository.js';
import { registerImportRoutes } from './http/routes.js';
import type { SourcesDeps } from './use-cases/deps.js';
import { createImportWorker } from './worker.js';

export {
  extractQuestions,
  type ExtractedQuestion,
  type ReadingMode,
} from './use-cases/extract-questions.js';
export { suggestMarks } from './use-cases/suggest-marks.js';

interface SourcesSettings {
  db: Db;
  clock: Clock;
  blobs: BlobStore;
  questions: Questions;
  ai: Pick<Ai, 'openOwned' | 'estimateFor'>;
  requireActor: RequireActor;
  maxUploadBytes: number;
  maxPages: number;
}

/** Uploaded sources and their imports: upload, durable job queue, reading, report (M4). */
export function createSources(settings: SourcesSettings) {
  const deps: SourcesDeps = {
    imports: createImportRepository(settings.db),
    blobs: settings.blobs,
    questions: settings.questions,
    ai: settings.ai,
    clock: settings.clock,
    newId,
    maxUploadBytes: settings.maxUploadBytes,
    maxPages: settings.maxPages,
  };
  return {
    worker: createImportWorker(deps),
    register: (app: FastifyInstance) => {
      void app.register(async (scope) => {
        await scope.register(multipart);
        registerImportRoutes(scope, deps, settings.requireActor);
      });
    },
  };
}
