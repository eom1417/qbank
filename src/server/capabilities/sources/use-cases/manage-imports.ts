import type {
  ImportResponse,
  MediaListResponse,
  RetryImportRequest,
  SourceListResponse,
} from '../../../../contracts/sources.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { JobRow } from '../adapters/import-repository.js';
import type { SourcesDeps } from './deps.js';

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
  return {
    id: job.id,
    sourceId: source.id,
    bankId: source.bank_id,
    fileName: source.file_name,
    stage: job.stage,
    pagesTotal: job.pages_total,
    pagesDone: job.pages_done,
    questionsFound: job.questions_found,
    questionsReview: job.questions_review,
    aiOutcome: job.ai_outcome,
    errorCode: job.error_code,
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
export async function retryImport(
  deps: SourcesDeps,
  actor: Actor,
  jobId: string,
  input: RetryImportRequest,
) {
  const { job, source } = await ownedJob(deps, actor, jobId);
  if (!RETRYABLE.has(job.stage)) throw new AppError('not_retryable');
  if (!source.blob_key) throw new AppError('original_deleted');
  if (input.aiProviderId && !(await deps.ai.estimateFor(actor.accountId, input.aiProviderId))) {
    throw new AppError('validation_failed', { aiProviderId: 'invalid_value' });
  }
  await deps.imports.forgetFailedPages(job.id);
  const aiProviderId = input.aiProviderId === undefined ? job.ai_provider_id : input.aiProviderId;
  await deps.imports.update(job.id, {
    stage: 'queued',
    attempts: job.attempts + 1,
    ai_provider_id: aiProviderId,
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
  if (!isId(bankId)) throw notFound();
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
