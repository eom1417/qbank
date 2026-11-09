import {
  Enhancements,
  NO_ENHANCEMENTS,
  TriageModels,
  type ImportResponse,
  type RecentImportsResponse,
  type MediaListResponse,
  type RetryImportRequest,
  type SourceListResponse,
} from '../../../../contracts/sources.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { JobRow } from '../adapters/import-repository.js';
import type { SourcesDeps } from './deps.js';
import { aiTargetOf } from './verify-with-ai.js';

/** What a job improves (DEC-34); an old job without the column improves nothing. */
export function enhanceOf(job: Pick<JobRow, 'ai_enhance'>): Enhancements {
  const parsed = Enhancements.safeParse(job.ai_enhance);
  return parsed.success ? parsed.data : NO_ENHANCEMENTS;
}

/** The AI a job ran on, as its report says it (DEC-33). */
function aiOf(job: JobRow): ImportResponse['ai'] {
  if (!job.ai_provider_id) return null;
  const models = TriageModels.safeParse(job.ai_roles);
  return {
    instanceId: job.ai_provider_id,
    model: job.ai_model,
    enhance: enhanceOf(job),
    models: models.success ? models.data : {},
  };
}

async function ownedJob(deps: SourcesDeps, actor: Actor, jobId: string) {
  const job = isId(jobId) ? await deps.imports.findJob(actor.accountId, jobId) : undefined;
  const source = job && (await deps.imports.findSource(actor.accountId, job.source_id));
  if (!job || !source) throw notFound();
  return { job, source };
}

/** One file's progress and report (UI-08, UI-09): real counts and every page with a problem. */
export async function getImport(
  deps: SourcesDeps,
  actor: Actor,
  jobId: string,
): Promise<ImportResponse> {
  const { job, source } = await ownedJob(deps, actor, jobId);
  const pages = await deps.imports.reportPages(job.id);
  const queuePosition = await deps.imports.queuePosition(job.id, deps.clock.now());
  return {
    id: job.id,
    sourceId: source.id,
    bankId: source.bank_id,
    fileName: source.file_name,
    stage: job.stage,
    pagesTotal: job.pages_total,
    pagesDone: job.pages_done,
    queuePosition,
    questionsFound: job.questions_found,
    questionsReview: job.questions_review,
    aiOutcome: job.ai_outcome,
    errorCode: job.error_code,
    ai: aiOf(job),
    createdAt: job.created_at.toISOString(),
    finishedAt: job.finished_at?.toISOString() ?? null,
    pages: pages.map((page) => ({
      page: page.page_no,
      status: page.status,
      reading: page.reading,
      warning: page.warning,
    })),
  };
}

/** Removes a file whose import has not started (FR-04-008): its source and original go. */
export async function cancelImport(deps: SourcesDeps, actor: Actor, jobId: string) {
  const { job, source } = await ownedJob(deps, actor, jobId);
  if (job.stage !== 'queued' || job.locked_until) throw new AppError('not_retryable');
  await deps.imports.removeSource(actor.accountId, source.id);
  if (source.blob_key) await deps.blobs.remove(source.blob_key);
}

const RETRYABLE: ReadonlySet<JobRow['stage']> = new Set([
  'failed',
  'partial_failure',
  'needs_review',
]);

/**
 * Runs an ended import again (FR-23-005): failed pages are read again, pages already read are
 * kept, and questions are updated in place, never duplicated (UAT-085). The AI connection may
 * be changed, e.g. after fixing an expired key (JY-14).
 */
/** The AI for a retry: the one chosen now, or the job's own when none was sent. */
function retryTarget(job: JobRow, input: RetryImportRequest) {
  if (input.aiProviderId === undefined)
    return { ai_provider_id: job.ai_provider_id, ai_model: job.ai_model };
  return {
    ai_provider_id: input.aiProviderId,
    ai_model: input.aiProviderId ? (input.aiModel ?? null) : null,
  };
}

export async function retryImport(
  deps: SourcesDeps,
  actor: Actor,
  jobId: string,
  input: RetryImportRequest,
) {
  const { job, source } = await ownedJob(deps, actor, jobId);
  if (!RETRYABLE.has(job.stage)) throw new AppError('not_retryable');
  if (job.ai_mode !== 'recheck' && !source.blob_key) throw new AppError('original_deleted');
  const ai = retryTarget(job, input);
  if (input.aiProviderId && !(await deps.ai.estimateFor(actor.accountId, aiTargetOf(ai)))) {
    throw new AppError('validation_failed', { aiProviderId: 'invalid_value' });
  }
  await deps.imports.forgetFailedPages(job.id);
  await deps.imports.update(job.id, {
    stage: 'queued',
    attempts: job.attempts + 1,
    ...ai,
    ai_outcome: null,
    error_code: null,
    finished_at: null,
    locked_until: null,
    pages_done: await deps.imports.countPages(job.id),
    updated_at: deps.clock.now(),
  });
}

/** A bank's sources with their latest import and question counts (UI-23, FR-03-002). */
export async function listSources(
  deps: SourcesDeps,
  actor: Actor,
  bankId: string,
): Promise<SourceListResponse> {
  if (!isId(bankId) || !(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
  const rows = await deps.imports.listSources(actor.accountId, bankId);
  const counts = new Map(
    (await deps.questions.countsBySource(actor.accountId, bankId)).map((c) => [c.sourceId, c]),
  );
  const sources = rows.map((row) => ({
    id: row.id,
    bankId: row.bank_id,
    fileName: row.file_name,
    pageCount: row.page_count,
    pageFrom: row.page_from,
    pageTo: row.page_to,
    language: row.language,
    sourceType: row.source_type as SourceListResponse['sources'][number]['sourceType'],
    createdAt: row.created_at.toISOString(),
    questions: {
      total: counts.get(row.id)?.total ?? 0,
      needsReview: counts.get(row.id)?.needsReview ?? 0,
      eligible: counts.get(row.id)?.eligible ?? 0,
    },
    answersFor: row.answers_for_source_id,
    originalExpiresAt: row.blob_key ? (row.original_expires_at?.toISOString() ?? null) : null,
    latestImport: { id: row.job_id, stage: row.job_stage },
    hasOriginal: row.blob_key !== null,
  }));
  return { sources };
}

/**
 * Deletes a source's uploaded original at the user's request (FR-19-001, DEC-13: erased on
 * request). The source, its page attribution and its questions stay; it cannot be read again.
 */
export async function deleteOriginal(deps: SourcesDeps, actor: Actor, sourceId: string) {
  const source = isId(sourceId) ? await deps.imports.findSource(actor.accountId, sourceId) : null;
  if (!source) throw notFound();
  const running = await deps.imports.runningJobOf(source.id);
  if (running) throw new AppError('not_retryable');
  if (!source.blob_key) return;
  await deps.imports.forgetOriginal(actor.accountId, source.id);
  await deps.blobs.remove(source.blob_key);
}

/** The pictures an import kept, with the question each belongs to (UI-09, M5). */
export async function listImportMedia(
  deps: SourcesDeps,
  actor: Actor,
  jobId: string,
): Promise<MediaListResponse> {
  const { source } = await ownedJob(deps, actor, jobId);
  const rows = await deps.questions.mediaOfSource(actor.accountId, source.id);
  return {
    media: rows.map((row) => ({
      id: row.id,
      questionNumber: row.question_number,
      page: row.page,
      position: row.position,
      kind: row.kind,
      modality: row.modality,
      link: row.link,
      lowQuality: row.low_quality,
      width: row.width,
      height: row.height,
    })),
  };
}

/** A kept picture's stored file, only for its owner (anyone else gets a plain 404). */
export async function mediaFile(deps: SourcesDeps, actor: Actor, mediaId: string) {
  const media = isId(mediaId) ? await deps.questions.findMedia(actor.accountId, mediaId) : null;
  if (!media) throw notFound();
  return deps.blobs.pathOf(media.blob_key);
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Imports that ended in the last week, for the in-app notice (FR-22-003, M14.4). */
export async function recentImports(
  deps: SourcesDeps,
  actor: Actor,
): Promise<RecentImportsResponse> {
  const since = new Date(deps.clock.now().getTime() - WEEK_MS);
  const rows = await deps.imports.recentlyEnded(actor.accountId, since);
  return {
    imports: rows.map((row) => ({
      id: row.id,
      bankId: row.bank_id,
      fileName: row.file_name,
      stage: row.stage,
      questionsFound: row.questions_found,
      needsReview: row.questions_review,
      finishedAt: (row.finished_at ?? deps.clock.now()).toISOString(),
    })),
  };
}
