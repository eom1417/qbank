import { runStep } from '../detection/progress.js';
import type { SourceLanguage } from '../../../../contracts/sources.js';
import type { ImportStage } from '../../../platform/db/schema.js';
import type { JobRow, PageRow, SourceRow } from '../adapters/import-repository.js';
import { readScan, readTextLayer } from '../adapters/readers.js';
import type { PageText } from '../domain/page.js';
import { hasUnreadableText, repairWithOcr } from '../domain/repair.js';
import { screenQuestions, type PageReading } from '../domain/screening.js';
import type { SourcesDeps } from './deps.js';
import { applyAnswerFile } from './apply-answer-file.js';
import { cropMedia, storeMedia } from './keep-media.js';
import { readSource } from './read-source.js';
import { recheckOutcome, triageImport } from './triage-import.js';
import { verifyWithAi } from './verify-with-ai.js';
import {
  CURRICULUM_VERSION,
  openLessons,
  rulesOnly,
  type PipelineReading,
} from './read-with-pipeline.js';
import { aiFailed, readKeeping } from './pipeline-stops.js';
import { keepBlocks, tierOf } from './pipeline-report.js';
import { stepRecorder } from './import-steps.js';
import { enhanceOf } from './manage-imports.js';
import { revokedKey } from '../adapters/measurements.js';

/** A page with fewer words than this has no usable text layer: it is read as a scan. */
const MIN_TEXT_WORDS = 6;
/** OCR that finds fewer words than this could not read the page: it is reported, not guessed. */
const MIN_OCR_WORDS = 3;
/** How long a worker owns a job between heartbeats; a crashed worker's job is taken again. */
export const LEASE_MS = 10 * 60_000;

type PageResult = Pick<PageRow, 'status' | 'reading' | 'warning'> & { page: PageText };

/** Reads one page: its text layer, or OCR when it is a scan (FR-05-001), never a guess (FR-23-002). */
async function readPage(
  file: string,
  pageNo: number,
  text: PageText | undefined,
  language: SourceLanguage,
): Promise<PageResult> {
  if (text && text.words.length >= MIN_TEXT_WORDS) {
    const page = hasUnreadableText(text)
      ? repairWithOcr(text, await readScan(file, pageNo, language))
      : text;
    return { status: 'done', reading: 'text', warning: null, page };
  }
  const page = await readScan(file, pageNo, language);
  if (page.words.length < MIN_OCR_WORDS)
    return { status: 'unreadable', reading: 'ocr', warning: 'unreadable_page', page };
  return { status: 'done', reading: 'ocr', warning: 'ocr', page };
}

const heartbeat = (deps: SourcesDeps) => ({
  updated_at: deps.clock.now(),
  locked_until: new Date(deps.clock.now().getTime() + LEASE_MS),
});

/** Stage 1: every page of the range not read yet, with a checkpoint after each (M4.7). */
async function readPages(deps: SourcesDeps, job: JobRow, source: SourceRow, file: string) {
  const done = new Set((await deps.imports.pages(job.id)).map((page) => page.page_no));
  const range = { from: source.page_from, to: source.page_to };
  const textLayer = await readTextLayer(file, range).catch(() => [] as PageText[]);
  const textOf = new Map(textLayer.map((page) => [page.page, page]));
  for (let pageNo = range.from; pageNo <= range.to; pageNo++) {
    if (done.has(pageNo)) continue;
    const result = await readPage(file, pageNo, textOf.get(pageNo), source.language).catch(
      (): PageResult => ({
        status: 'failed',
        reading: 'text',
        warning: 'read_failed',
        page: { page: pageNo, width: 0, height: 0, words: [] },
      }),
    );
    const { page, ...checkpoint } = result;
    await deps.imports.savePage({
      job_id: job.id,
      page_no: pageNo,
      ...checkpoint,
      content: JSON.stringify(page),
    });
    await deps.imports.update(job.id, {
      pages_done: await deps.imports.countPages(job.id),
      ...heartbeat(deps),
    });
  }
}

function finalStage(pages: readonly PageRow[], review: number, aiOutcome: string): ImportStage {
  const read = pages.filter((page) => page.status !== 'failed');
  if (read.length === 0) return 'failed';
  if (read.length < pages.length) return 'partial_failure';
  return review > 0 || !['not_used', 'done'].includes(aiOutcome) ? 'needs_review' : 'completed';
}

const setStage = (deps: SourcesDeps, job: JobRow, stage: ImportStage) =>
  deps.imports.update(job.id, { stage, ...heartbeat(deps) });

const contentOf = (pages: readonly PageRow[], statuses: readonly string[]) =>
  pages.filter((page) => statuses.includes(page.status)).map((page) => page.content as PageText);

/** The questions and pictures of the pages read, by the detection's rules. */
async function readQuestions(file: string, rows: PageRow[]) {
  const pages = contentOf(rows, ['done']);
  return { ...(await readSource(file, pages)), pages };
}

/**
 * Stages 2–4: extract, screen (then the user's AI), save without duplicates (the original as
 * version 1), then the AI triage settles answers on the saved questions (DEC-33).
 */
async function extractAndSave(deps: SourcesDeps, job: JobRow, source: SourceRow, file: string) {
  await setStage(deps, job, 'extracting');
  const pages = await deps.imports.pages(job.id);
  const read = await readQuestions(file, pages);
  const { questions: extracted, media } = read;
  const { cropped, reasons } = await cropMedia(file, read.pages, media);
  await setStage(deps, job, 'verifying');
  const readings = new Map<number, PageReading>(
    pages.map((page) => [
      page.page_no,
      { reading: page.reading, unreadable: page.status === 'unreadable' },
    ]),
  );
  const screened = screenQuestions(extracted, readings, reasons);
  const verified = await verifyWithAi(deps, job, file, screened);
  const place = { ownerId: job.owner_id, bankId: source.bank_id, sourceId: source.id };
  await deps.questions.saveImported(place, verified.questions, deps.clock.now());
  const triaged =
    job.ai_provider_id && verified.aiOutcome === 'done'
      ? await triageImport(deps, job, source.id)
      : null;
  await setStage(deps, job, 'matching');
  await storeMedia(deps, place, cropped, extracted);
  return {
    pages,
    questions: verified.questions,
    aiOutcome: triaged?.aiOutcome ?? verified.aiOutcome,
  };
}

/**
 * Why a finished question import has nothing to study: the file could not be read, or it was
 * read and no question came out of it (notes, or a scan too poor). Never a quiet success (M26).
 */
function errorOf(stage: ImportStage, questions: number) {
  if (stage === 'failed') return 'unreadable_file';
  return questions === 0 ? 'no_questions' : null;
}

/** The job's final counts and stage from its saved questions (FR-04-011). */
async function countsOf(deps: SourcesDeps, job: JobRow, pages: PageRow[], found: number) {
  const saved = await deps.questions.questionsOfSource(job.owner_id, job.source_id);
  const review = saved.filter((row) => row.status === 'needs_review').length;
  return { review, stage: (aiOutcome: string) => finalStage(pages, review, aiOutcome), found };
}

/** Stages 2–4 for a question source: the job's final counts and stage. */
async function questionsOutcome(deps: SourcesDeps, job: JobRow, source: SourceRow, file: string) {
  // Whole-page AI reading (M33) is the detection with the AI on its doubts since M39.
  const detected = job.ai_mode === 'pipeline' || (job.ai_mode === 'read' && !!job.ai_provider_id);
  if (detected) return pipelineOutcome(deps, job, source, file);
  const { pages, questions, aiOutcome } = await extractAndSave(deps, job, source, file);
  const counts = await countsOf(deps, job, pages, questions.length);
  const stage = counts.stage(aiOutcome);
  return {
    stage,
    questions_found: questions.length,
    questions_review: counts.review,
    ai_outcome: aiOutcome,
    error_code: errorOf(stage, questions.length),
  };
}

/** The pipeline's questions saved with their placed pictures, cases and tags; then M19 triage. */
async function savePipeline(
  deps: SourcesDeps,
  job: JobRow,
  source: SourceRow,
  context: { file: string; rows: PageRow[]; read: PipelineReading },
) {
  const pages = contentOf(context.rows, ['done', 'unreadable']);
  const { cropped, reasons } = await cropMedia(context.file, pages, context.read.media);
  const questions = context.read.questions.map((question, index) => ({
    ...question,
    reasons: [...question.reasons, ...(reasons.get(index) ?? [])],
  }));
  await setStage(deps, job, 'verifying');
  const place = { ownerId: job.owner_id, bankId: source.bank_id, sourceId: source.id };
  await deps.questions.saveImported(place, questions, deps.clock.now());
  await deps.questions.saveImportExtras(place, questions, context.read.extras);
  const triaged = job.ai_provider_id
    ? await triageImport(deps, job, source.id)
    : { aiOutcome: 'not_used' };
  await setStage(deps, job, 'matching');
  await storeMedia(deps, place, cropped, questions);
  return { questions, aiOutcome: triaged.aiOutcome };
}

/** The capture choice of the job (M39, Q135): on unless the upload turned it off. */
const captureOf = (job: JobRow) => enhanceOf(job).improveCapture !== false;

/** The job's selected provider, or rule-only lessons when no AI was requested. */
async function lessonsForJob(deps: SourcesDeps, job: JobRow) {
  const owner = {
    ownerId: job.owner_id,
    instanceId: job.ai_provider_id ?? '',
    model: job.ai_model,
  };
  const revoked = await deps.measurements.revoked();
  const rest = {
    cache: deps.steps,
    now: () => deps.clock.now(),
    startTier: tierOf(job) ?? 'light',
    approved: (lesson: string, model: string) => !revoked.has(revokedKey(lesson, model)),
  };
  // No AI chosen: the same detection with no model (M39). An AI chosen but gone fails (Z4).
  return job.ai_provider_id ? openLessons(deps.ai, owner, rest) : rulesOnly(job.owner_id, rest);
}

/** A file with unowned source defects cannot quietly finish as complete. */
function detectionStage(stage: ImportStage, issues: PipelineReading['issues']): ImportStage {
  return stage === 'completed' && issues?.length ? 'needs_review' : stage;
}

/** M34: a question source read by the pipeline with the user's AI (Z4, Q16). */
async function pipelineOutcome(deps: SourcesDeps, job: JobRow, source: SourceRow, file: string) {
  await setStage(deps, job, 'extracting');
  const lessons = await lessonsForJob(deps, job);
  if (!lessons) return aiFailed('ai_not_ready', 'not_ready');
  const rows = await deps.imports.pages(job.id);
  const readings = new Map(
    rows.map((row) => [
      row.page_no,
      { reading: row.reading, unreadable: row.status === 'unreadable' },
    ]),
  );
  const pages = { from: source.page_from, to: source.page_to };
  const captureAi = !!job.ai_provider_id && captureOf(job);
  const steps = {
    onStep: stepRecorder(deps, job.id),
    captureAi,
    answerAi: !!job.ai_provider_id,
    sourcePages: contentOf(rows, ['done', 'unreadable']),
  };
  const reading = await readKeeping(deps, job, lessons, { file, pages, readings, ...steps });
  if (reading === null) return null;
  if ('failed' in reading) return reading.failed;
  const { read, usage, stoppedBy, detail } = reading;
  const { saved, facts } = await runStep(
    steps.onStep,
    'save',
    async () => {
      const saved = await savePipeline(deps, job, source, { file, rows, read });
      return { saved, facts: await keepBlocks(deps, job, read) };
    },
    (result) => `${result.saved.questions.length}`,
  );
  const counts = await countsOf(deps, job, rows, saved.questions.length);
  const aiOutcome = stoppedBy ?? saved.aiOutcome;
  const stage = detectionStage(counts.stage(aiOutcome), read.issues);
  return {
    stage,
    questions_found: counts.found,
    questions_review: counts.review,
    ai_outcome: aiOutcome,
    error_code: stoppedBy ? 'ai_stopped' : errorOf(stage, counts.found),
    ai_detail: detail,
    ai_usage: usage,
    curriculum_version: CURRICULUM_VERSION,
    pipeline_facts: facts,
  };
}

/** Stage 2 for an answer-key file: how many questions it answered, and how many disagree. */
async function answerFileOutcome(deps: SourcesDeps, job: JobRow, source: SourceRow) {
  await setStage(deps, job, 'matching');
  const pages = (await deps.imports.pages(job.id))
    .filter((page) => page.status === 'done')
    .map((page) => page.content as PageText);
  const { matched, conflicts } = await applyAnswerFile(deps, job, source, pages);
  const stage: ImportStage =
    matched === 0 ? 'failed' : conflicts > 0 ? 'needs_review' : 'completed';
  return {
    stage,
    questions_found: matched,
    questions_review: conflicts,
    ai_outcome: 'not_used',
    error_code: matched === 0 ? 'no_key_entries' : null,
  };
}

/**
 * When the original is erased on its own (DEC-13, assumed: a short, stated period). A partly
 * read file keeps it until the user decides (DEC-14); the user may delete it any time.
 */
function expiryOf(deps: SourcesDeps, stage: ImportStage): Date | null {
  if (stage === 'partial_failure') return null;
  return new Date(deps.clock.now().getTime() + deps.originalRetentionMs);
}

type Finish = (changes: Parameters<SourcesDeps['imports']['update']>[1]) => Promise<unknown>;

/** A re-check needs no file: only the saved questions are triaged again. */
async function recheck(deps: SourcesDeps, job: JobRow, finish: Finish) {
  try {
    await finish(await recheckOutcome(deps, job));
  } catch (error) {
    deps.log.error({ jobId: job.id, err: error }, 'recheck failed');
    await finish({ stage: 'failed', error_code: 'internal' });
  }
}

/** Runs (or resumes) one import job to its end; failures are recorded on the job, never thrown. */
export async function runImport(deps: SourcesDeps, job: JobRow): Promise<void> {
  const source = await deps.imports.findSource(job.owner_id, job.source_id);
  const finish = (changes: Parameters<SourcesDeps['imports']['update']>[1]) =>
    deps.imports.update(job.id, {
      ...changes,
      locked_until: null,
      finished_at: deps.clock.now(),
      updated_at: deps.clock.now(),
    });
  if (source && job.ai_mode === 'recheck') return recheck(deps, job, finish);
  if (!source?.blob_key)
    return void (await finish({ stage: 'failed', error_code: 'source_missing' }));
  const file = deps.blobs.pathOf(source.blob_key);
  try {
    await setStage(deps, job, 'reading');
    await readPages(deps, job, source, file);
    const outcome = source.answers_for_source_id
      ? await answerFileOutcome(deps, job, source)
      : await questionsOutcome(deps, job, source, file);
    // A paused pipeline job keeps its stage and lease until its subscription renews (Q16).
    if (outcome === null) return;
    await finish(outcome);
    await deps.imports.setOriginalExpiry(source.id, expiryOf(deps, outcome.stage));
  } catch (error) {
    deps.log.error({ jobId: job.id, err: error }, 'import failed');
    await finish({ stage: 'failed', error_code: 'internal' });
  }
}
