import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import { newId } from '../../platform/ids.js';
import type { BlobStore } from '../../platform/storage/blob-store.js';
import type { ImportAi } from '../providers/index.js';
import type { RequireActor } from '../identity/index.js';
import type { Questions } from '../questions/index.js';
import { createImportRepository } from './adapters/import-repository.js';
import {
  originalsOfBank,
  restoreSources,
  sourcesOfBank,
  type PortableSource,
} from './use-cases/portability.js';
import { registerImportRoutes, registerSourceRoutes } from './http/routes.js';
import type { SourcesDeps } from './use-cases/deps.js';
import { listQueue } from './use-cases/import-queue.js';
import { createImportWorker } from './worker.js';
import { linkOpens } from './adapters/link-check.js';

export { extractQuestions } from './use-cases/read-source.js';
export type { ExtractedQuestion, ReadingMode } from './use-cases/extract-questions.js';
export { suggestMarks } from './use-cases/suggest-marks.js';
export { triageAnswers } from './use-cases/triage-answers.js';
export type { TriageItem, Triaged } from './use-cases/triage-answers.js';

interface SourcesSettings {
  db: Db;
  clock: Clock;
  blobs: BlobStore;
  questions: Questions;
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  ai: ImportAi;
  requireActor: RequireActor;
  maxUploadBytes: number;
  maxPages: number;
  /** The sample bank's PDF (M28.1). */
  samplePdf: string;
  originalRetentionDays: number;
  /** Imports running at once across accounts (`imports.workers`, M31); one when absent. */
  workers?: number;
  log: SourcesDeps['log'];
  /** Whether a source link opens; the real web unless a test replaces it. */
  checkLink?: (url: string) => Promise<boolean>;
}

/** Uploaded sources and their imports: upload, durable job queue, reading, report (M4). */
export function createSources(settings: SourcesSettings) {
  const deps: SourcesDeps = {
    ownsBank: settings.ownsBank,
    log: settings.log,
    imports: createImportRepository(settings.db),
    blobs: settings.blobs,
    questions: settings.questions,
    ai: settings.ai,
    clock: settings.clock,
    checkLink: settings.checkLink ?? linkOpens,
    newId,
    maxUploadBytes: settings.maxUploadBytes,
    maxPages: settings.maxPages,
    samplePdf: settings.samplePdf,
    originalRetentionMs: settings.originalRetentionDays * 24 * 60 * 60_000,
    workers: settings.workers ?? 1,
  };
  return {
    worker: createImportWorker(deps),
    /** The server-wide import queue for the operator's card (M31, B2). */
    listQueue: () => listQueue(deps),
    /** The bank's sources for an export, without originals (M13). */
    sourcesOfBank: (ownerId: string, bankId: string) => sourcesOfBank(deps, ownerId, bankId),
    /** The stored originals of a bank, erased with it (FR-19-005). */
    originalsOfBank: (ownerId: string, bankId: string) => originalsOfBank(deps, ownerId, bankId),
    /** Recreates exported sources in a restored bank (FR-18-005). */
    restoreSources: (ownerId: string, bankId: string, sources: readonly PortableSource[]) =>
      restoreSources(deps, ownerId, bankId, sources),
    /** The newest import of the last week that failed or was only partly read (M17.3). */
    lastFailure: async (ownerId: string, since: Date) => {
      const ended = await deps.imports.recentlyEnded(ownerId, since);
      const failed = ended.find((job) => ['failed', 'partial_failure'].includes(job.stage));
      return failed
        ? { fileName: failed.file_name, stage: failed.stage, at: failed.finished_at }
        : null;
    },
    register: (app: FastifyInstance) => {
      void app.register(async (scope) => {
        await scope.register(multipart);
        registerImportRoutes(scope, deps, settings.requireActor);
        registerSourceRoutes(scope, deps, settings.requireActor);
      });
    },
  };
}
