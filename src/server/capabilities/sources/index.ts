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
import { createStepCache } from './adapters/step-cache.js';
import { createBlockRepository } from './adapters/import-blocks.js';
import { createMeasurementRepository } from './adapters/measurements.js';
import { registerReviewEditorRoutes } from './http/review-routes.js';
import { measureDue, operatorAiOf, type MeasureDeps } from './use-cases/weekly-measure.js';

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
  requiresAi: SourcesDeps['requiresAi'];
  /** Imports running at once across accounts (`imports.workers`, M31); one when absent. */
  workers?: number;
  log: SourcesDeps['log'];
  /** Whether a source link opens; the real web unless a test replaces it. */
  checkLink?: (url: string) => Promise<boolean>;
  mode: SourcesDeps['mode'];
  aiConsentOf: SourcesDeps['aiConsentOf'];
  /** The weekly measurement's operator AI and alert (Q15); none on a local install. */
  measure?: { operatorId(): Promise<string | null>; alert: MeasureDeps['alert'] };
}

/** The weekly model measurement (Q15) with the operator's AI; nothing without an operator. */
function weeklyMeasure(deps: SourcesDeps, measure: SourcesSettings['measure']) {
  if (!measure) return Promise.resolve('no_ai' as const);
  const now = () => deps.clock.now();
  const { measurements } = deps;
  const operatorAi = async () =>
    operatorAiOf({ ai: deps.ai, measurements, now }, await measure.operatorId());
  return measureDue({ operatorAi, alert: measure.alert, measurements, now });
}

/** What every sources use case receives, from the settings and the repositories. */
function sourcesDeps(settings: SourcesSettings): SourcesDeps {
  return {
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
    mode: settings.mode,
    requiresAi: settings.requiresAi,
    aiConsentOf: settings.aiConsentOf,
    steps: createStepCache(settings.db),
    blocks: createBlockRepository(settings.db, newId),
    measurements: createMeasurementRepository(settings.db, newId),
  };
}

/** Uploaded sources and their imports: upload, durable job queue, reading, report (M4). */
export function createSources(settings: SourcesSettings) {
  const deps = sourcesDeps(settings);
  return {
    worker: createImportWorker(deps),
    /** The weekly model measurement (Q15): main.ts checks hourly, tests call it directly. */
    measureDue: () => weeklyMeasure(deps, settings.measure),
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
        registerReviewEditorRoutes(scope, deps, settings.requireActor);
      });
    },
  };
}
