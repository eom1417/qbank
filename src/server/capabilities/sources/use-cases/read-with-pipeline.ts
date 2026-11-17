// M34 P5: a file read by the import pipeline: questions with placed pictures (P4a), the answer
// evidence with the vision lesson (P4b), the value filter (level 5), then each question's
// review reasons (level 7), its kept pictures with their placement, its case and its tags.
import { z } from 'zod';
import { LessonUsage as UsageRow } from '../../../../contracts/sources.js';
import type { AiFailure, AiProvider, ImportAi } from '../../providers/index.js';
import type { ImportExtras, ImportedQuestion } from '../../questions/index.js';
import { approvedModels, type ProviderKind } from '../domain/pipeline/approved-models.js';
import { markLesson } from '../domain/pipeline/lessons/mark.js';
import { PROMPT_VERSION } from '../domain/pipeline/prompt-standard.js';
import type { PipelinePicture, PipelineQuestion } from '../domain/pipeline/question.js';
import { evidenceOf, pipelineReasons } from '../domain/pipeline/statuses.js';
import { filterValue } from '../domain/pipeline/value-filter.js';
import { screenQuestions, type PageReading } from '../domain/screening.js';
import type { ExtractedQuestion } from './extract-questions.js';
import type { KeptLink, MediaPlace } from './keep-media.js';
import { withEvidence, type EvidenceDeps, type EvidenceOptions } from './pipeline-evidence.js';
import { pipelineQuestions } from './pipeline-questions.js';
import type { LessonDeps, LessonUsage } from './run-lesson.js';

export interface PipelineDeps extends EvidenceDeps {
  /** The file's questions with their pictures placed; the real reader unless a test passes one. */
  readQuestions?: (file: string) => Promise<{ questions: PipelineQuestion[] }>;
}

export interface PipelineInput {
  file: string;
  /** The page range the owner chose; questions outside it are not imported. */
  pages: { from: number; to: number };
  /** How each page was read (stage 1): an OCR or unreadable page is said in review. */
  readings: ReadonlyMap<number, PageReading>;
}

/** Why the AI stopped: a full subscription pauses until `resumeAfter`, anything else fails. */
interface PipelineStop {
  failure: AiFailure;
  resumeAfter: Date | null;
}

export interface PipelineReading {
  questions: ImportedQuestion[];
  /** The pictures to keep, each with its question's index and its placement. */
  media: KeptLink[];
  extras: ImportExtras;
  usage: LessonUsage[];
  stopped: PipelineStop | null;
}

/** What a pipeline job ran with: the prompt standard and its lesson's version. */
export const CURRICULUM_VERSION = `prompt-${PROMPT_VERSION}/${markLesson.id}-${markLesson.version}`;

/** A job's earlier lesson usage plus this run's, summed per lesson and model, for the report. */
export function sumUsage(previous: unknown, usage: readonly LessonUsage[]): UsageRow[] {
  const earlier = z.array(UsageRow).safeParse(previous);
  const rows = new Map(
    (earlier.success ? earlier.data : []).map((row) => [`${row.lesson}\n${row.model}`, row]),
  );
  for (const call of usage) {
    const key = `${call.lesson}\n${call.model}`;
    const row = rows.get(key) ?? { ...call, calls: 0, inputTokens: 0, outputTokens: 0 };
    rows.set(key, {
      lesson: call.lesson,
      model: call.model,
      calls: row.calls + 1,
      inputTokens: row.inputTokens + call.inputTokens,
      outputTokens: row.outputTokens + call.outputTokens,
      estimated: row.estimated || call.estimated,
    });
  }
  return [...rows.values()];
}

/** The lessons whose approved models decide which provider kind an instance is. */
const LESSON = markLesson.id;
const KINDS: readonly ProviderKind[] = ['claude', 'codex'];

const unavailable: AiProvider = {
  generate: () => Promise.resolve({ ok: false, failure: 'model_missing' }),
};

/**
 * The user's provider for the lessons, or null when it is missing or not ready (Z4). Its kind
 * is the first whose approved models it all offers; a kind with none approved sends every item
 * to review, never to an unapproved model.
 */
export async function openLessons(
  ai: ImportAi,
  owner: { ownerId: string; instanceId: string; model: string | null },
  rest: Pick<LessonDeps, 'cache' | 'now'>,
): Promise<LessonDeps | null> {
  const { ownerId, instanceId, model } = owner;
  if (!(await ai.openOwned(ownerId, { instanceId, ...(model ? { model } : {}) }))) return null;
  for (const kind of KINDS) {
    const { light, strong } = approvedModels(LESSON, kind);
    const models = [...light, ...strong];
    const opened = await Promise.all(
      models.map((m) => ai.openOwned(ownerId, { instanceId, model: m })),
    );
    if (opened.some((provider) => provider === null)) continue;
    const providers = new Map(models.map((m, index) => [m, opened[index] ?? unavailable]));
    return {
      ownerId,
      providerKind: kind,
      providerFor: (m) => providers.get(m) ?? unavailable,
      ...rest,
    };
  }
  return null;
}

/** The pipeline question as the screening reads it (its lines as one area per page). */
const extractedOf = (question: PipelineQuestion): ExtractedQuestion => ({
  number: question.number,
  page: question.page,
  stem: question.stem,
  kind: question.options.length === 0 ? 'essay' : 'mcq',
  options: question.options.map(({ letter, label, text }) => ({ letter, label, text })),
  answer: question.answers[0] ?? null,
  answers: question.answers,
  evidence: evidenceOf(question),
  conflicts: [],
  multiSelect: question.answers.length > 1,
  explanation: question.explanation,
  spans: question.area.map((spot) => ({ page: spot.page, box: spot.box })),
});

/** The screening's reasons (no answer, essay, defects, pages) and the pipeline's own. */
export function importedQuestions(
  questions: readonly PipelineQuestion[],
  readings: ReadonlyMap<number, PageReading>,
): ImportedQuestion[] {
  const own = new Map(questions.map((question, index) => [index, pipelineReasons(question)]));
  return screenQuestions(questions.map(extractedOf), readings, own).map((imported, index) => ({
    ...imported,
    provenance: (questions[index]?.conflicts.length ?? 0) > 0 ? 'conflict' : imported.provenance,
  }));
}

/** An option picture needs its letter; without one it is shown with the question. */
const placeOf = (picture: PipelinePicture): MediaPlace =>
  picture.placement === 'option' && picture.optionLetter
    ? { placement: 'option', optionLetter: picture.optionLetter }
    : {
        placement: picture.placement === 'option' ? 'question' : picture.placement,
        optionLetter: null,
      };

/** Every kept picture once: a case's pictures are stored with the first question of the case. */
function mediaOf(questions: readonly PipelineQuestion[]): KeptLink[] {
  const seen = new Set<string>();
  return questions.flatMap((question, index) =>
    question.pictures.flatMap((picture): KeptLink[] => {
      if (seen.has(picture.unitId)) return [];
      seen.add(picture.unitId);
      const kind = picture.imageClass === 'table' ? 'table' : 'figure';
      const region = { page: picture.spot.page, box: picture.spot.box, kind, ppi: null } as const;
      return [{ region, question: index, certain: true, place: placeOf(picture) }];
    }),
  );
}

const tagNames = (question: PipelineQuestion) => [
  ...(question.tags.exam ? [`exam:${question.tags.exam}`] : []),
  ...(question.tags.year ? [`year:${question.tags.year}`] : []),
];

/** Shared cases by their text, and the `exam:` and `year:` tags of each question (Q67). */
function extrasOf(questions: readonly PipelineQuestion[]): ImportExtras {
  const cases = new Map<string, number[]>();
  questions.forEach((question, index) => {
    const text = question.caseText;
    if (text) cases.set(text, [...(cases.get(text) ?? []), index]);
  });
  const tags = questions.flatMap((question, index) => {
    const names = tagNames(question);
    return names.length > 0 ? [{ question: index, names }] : [];
  });
  return { cases: [...cases].map(([text, members]) => ({ text, questions: members })), tags };
}

const inRange = (input: PipelineInput) => (question: PipelineQuestion) =>
  question.page >= input.pages.from && question.page <= input.pages.to;

/**
 * Reads the file with the pipeline. When the AI stops (a full subscription, a refused key),
 * nothing is returned but the usage so far and why: the caller pauses or fails the job, and
 * a resumed run takes every finished lesson from the step cache.
 */
export async function readWithPipeline(
  deps: PipelineDeps,
  input: PipelineInput,
  options: EvidenceOptions = {},
): Promise<PipelineReading> {
  const read = await (deps.readQuestions ?? pipelineQuestions)(input.file);
  const run = await withEvidence(deps, input.file, read.questions.filter(inRange(input)), options);
  const stopped = run.failure ? { failure: run.failure, resumeAfter: run.resumeAfter } : null;
  if (stopped)
    return { questions: [], media: [], extras: { cases: [], tags: [] }, usage: run.usage, stopped };
  const kept = run.questions.map(filterValue);
  return {
    questions: importedQuestions(kept, input.readings),
    media: mediaOf(kept),
    extras: extrasOf(kept),
    usage: run.usage,
    stopped: null,
  };
}
