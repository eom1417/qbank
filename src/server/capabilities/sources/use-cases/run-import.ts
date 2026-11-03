import type { SourceLanguage } from '../../../../contracts/sources.js';
import type { ImportStage } from '../../../platform/db/schema.js';
import type { ImportedQuestion } from '../../questions/index.js';
import type { JobRow, PageRow, SourceRow } from '../adapters/import-repository.js';
import { readScan, readTextLayer } from '../adapters/readers.js';
import type { PageText } from '../domain/page.js';
import { hasUnreadableText, repairWithOcr } from '../domain/repair.js';
import { screenQuestions, type PageReading } from '../domain/screening.js';
import type { SourcesDeps } from './deps.js';
import { cropMedia, storeMedia } from './keep-media.js';
import { readSource } from './read-source.js';
import { verifyWithAi } from './verify-with-ai.js';

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

function finalStage(
  pages: readonly PageRow[],
  questions: readonly ImportedQuestion[],
  aiOutcome: string,
): ImportStage {
  const read = pages.filter((page) => page.status !== 'failed');
  if (read.length === 0) return 'failed';
  if (read.length < pages.length) return 'partial_failure';
  const review = questions.some((q) => q.reasons.some((reason) => reason !== 'essay'));
  return review || !['not_used', 'done'].includes(aiOutcome) ? 'needs_review' : 'completed';
}

const setStage = (deps: SourcesDeps, job: JobRow, stage: ImportStage) =>
  deps.imports.update(job.id, { stage, ...heartbeat(deps) });

/** Stages 2–4: extract, screen (then the user's AI), and save without duplicates. */
async function extractAndSave(deps: SourcesDeps, job: JobRow, source: SourceRow, file: string) {
  await setStage(deps, job, 'extracting');
  const pages = await deps.imports.pages(job.id);
  const readable = pages
    .filter((page) => page.status === 'done')
    .map((page) => page.content as PageText);
  const { questions: extracted, media } = await readSource(file, readable);
  const { cropped, reasons } = await cropMedia(file, readable, media);
  await setStage(deps, job, 'verifying');
  const readings = new Map<number, PageReading>(
    pages.map((page) => [
      page.page_no,
      { reading: page.reading, unreadable: page.status === 'unreadable' },
    ]),
  );
  const verified = await verifyWithAi(
    deps,
    job,
    file,
    screenQuestions(extracted, readings, reasons),
  );
  await setStage(deps, job, 'matching');
  const place = { ownerId: job.owner_id, bankId: source.bank_id, sourceId: source.id };
  await deps.questions.saveImported(place, verified.questions, deps.clock.now());
  await storeMedia(deps, place, cropped, extracted);
  return { pages, ...verified };
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
  if (!source?.blob_key)
    return void (await finish({ stage: 'failed', error_code: 'source_missing' }));
  const file = deps.blobs.pathOf(source.blob_key);
  try {
    await setStage(deps, job, 'reading');
    await readPages(deps, job, source, file);
    const { pages, questions, aiOutcome } = await extractAndSave(deps, job, source, file);
    const review = questions.filter((q) => q.reasons.some((reason) => reason !== 'essay')).length;
    const stage = finalStage(pages, questions, aiOutcome);
    await finish({
      stage,
      questions_found: questions.length,
      questions_review: review,
      ai_outcome: aiOutcome,
      error_code: stage === 'failed' ? 'unreadable_file' : null,
    });
  } catch {
    await finish({ stage: 'failed', error_code: 'internal' });
  }
}
