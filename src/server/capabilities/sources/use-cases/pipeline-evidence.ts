// M34 P4b: the answer-evidence step. The vision lesson D4.mark is asked only where the code did
// not decide by a printed key (plus a fixed audit sample of keyed questions, to catch hand marks
// that disagree with the key); then every question's signals are combined (D4.6).
import { createHash } from 'node:crypto';
import type { AiFailure } from '../../providers/index.js';
import { modelFor } from '../domain/pipeline/approved-models.js';
import { combineEvidence, type VisionVerdict } from '../domain/pipeline/evidence.js';
import {
  markedLetters,
  markLesson,
  type MarkInput,
  type MarkOutput,
} from '../domain/pipeline/lessons/mark.js';
import type { PipelineQuestion, Spot } from '../domain/pipeline/question.js';
import { cropQuestions, type QuestionCrop } from '../adapters/question-crops.js';
import {
  runLesson,
  type ItemResult,
  type LessonDeps,
  type LessonItem,
  type LessonOptions,
  type LessonRun,
  type LessonUsage,
} from './run-lesson.js';
import { SHEET_LIMIT } from '../domain/pipeline/sheet-layout.js';

export interface EvidenceDeps extends LessonDeps {
  /** Renders the questions' areas; the real one renders with poppler. */
  cropQuestions?: (
    file: string,
    questions: readonly PipelineQuestion[],
    pictures: readonly Spot[],
  ) => Promise<QuestionCrop[]>;
}

export interface EvidenceOptions extends LessonOptions {
  /** Every n-th keyed question is also asked, as an audit (10 = a fixed 10%); 0 = none. */
  auditEvery?: number;
  /** The file's printed pictures (image units that are not handwriting): blanked in the crops. */
  printedPictures?: readonly Spot[];
}

export interface EvidenceRun {
  /** In input order. A question whose lesson did not finish (a pause) is returned unchanged. */
  questions: PipelineQuestion[];
  usage: LessonUsage[];
  /** Keys of the questions shown to the vision lesson, and which of them were audits. */
  asked: string[];
  audited: string[];
  /** What the lesson said of each finished asked question (for the report and the bench). */
  marks: { key: string; verdict: VisionVerdict }[];
  paused: boolean;
  resumeAfter: Date | null;
  failure: AiFailure | null;
}

const AUDIT_EVERY = 10;

const keyed = (question: PipelineQuestion) => question.evidence.includes('printed_key');
/** Only where the area is known; a lone option is asked too, since it may be struck out. */
const markable = (question: PipelineQuestion) =>
  question.options.length > 0 && question.area.length > 0;

/** The questions to show the lesson: every unkeyed one, and every n-th keyed one. */
export function questionsToAsk(questions: readonly PipelineQuestion[], auditEvery = AUDIT_EVERY) {
  const asked: PipelineQuestion[] = [];
  const audited: PipelineQuestion[] = [];
  let keyedSeen = 0;
  for (const question of questions.filter(markable)) {
    if (!keyed(question)) asked.push(question);
    else if (auditEvery > 0 && keyedSeen++ % auditEvery === 0) audited.push(question);
  }
  return { asked: [...asked, ...audited], audited };
}

const inputOf = (question: PipelineQuestion): MarkInput => ({
  options: question.options.map(({ letter, label }) => ({ letter, label })),
});

/** The crop's pixels and the options it is judged against are the item's identity. */
function itemOf(question: PipelineQuestion, crop: QuestionCrop): LessonItem<MarkInput> {
  const input = inputOf(question);
  const labels = input.options.map((option) => option.label).join('|');
  const fingerprint = createHash('sha256').update(`${crop.fingerprint}:${labels}`).digest('hex');
  return { input, fingerprint, image: crop.image, text: null };
}

function verdictOf(input: MarkInput, result: ItemResult<MarkOutput>): VisionVerdict {
  return result.status === 'answered' ? { mark: markedLetters(input, result.output) } : 'review';
}

/** A sheet's items and the questions they show, in cell order. */
interface Shown {
  questions: PipelineQuestion[];
  items: LessonItem<MarkInput>[];
}

async function showable(
  deps: EvidenceDeps,
  file: string,
  asked: readonly PipelineQuestion[],
  options: EvidenceOptions,
): Promise<Shown> {
  const crop = deps.cropQuestions ?? cropQuestions;
  const crops = await crop(file, asked, options.printedPictures ?? []);
  const cropByKey = new Map(crops.map((one) => [one.key, one]));
  const pairs = asked.flatMap((question) => {
    const one = cropByKey.get(question.key);
    return one ? [{ question, item: itemOf(question, one) }] : [];
  });
  return { questions: pairs.map((pair) => pair.question), items: pairs.map((pair) => pair.item) };
}

/** A mark that contradicts the reader's own signal: the light model may have read the wrong cell. */
function contradicts(question: PipelineQuestion, result: ItemResult<MarkOutput> | null): boolean {
  if (!result) return false;
  const combined = combineEvidence(question, verdictOf(inputOf(question), result));
  return combined.conflicts.length > question.conflicts.length;
}

/**
 * Every sheet where a mark contradicts the reader is asked again, whole, starting with the strong
 * model: a light model that shifts its answers by one cell gets the whole sheet wrong at once.
 */
async function recheckSheets(
  deps: EvidenceDeps,
  shown: Shown,
  run: LessonRun<MarkOutput>,
  options: EvidenceOptions,
): Promise<LessonRun<MarkOutput>> {
  const sheets = new Set(
    shown.questions.flatMap((question, i) =>
      contradicts(question, run.results[i] ?? null) ? [Math.floor(i / SHEET_LIMIT)] : [],
    ),
  );
  if (sheets.size === 0 || run.paused || deps.startTier === 'strong') return run;
  const again = shown.items.flatMap((item, i) =>
    sheets.has(Math.floor(i / SHEET_LIMIT)) ? [i] : [],
  );
  const items = again.map((i) => shown.items[i] as LessonItem<MarkInput>);
  const strong = await runLesson({ ...deps, startTier: 'strong' }, markLesson, items, options);
  const results = [...run.results];
  again.forEach((i, k) => (results[i] = strong.results[k] ?? null));
  return { ...strong, results, usage: [...run.usage, ...strong.usage] };
}

/** The vision mark alone would decide it: a second reading must confirm it (R1, Q85). */
function visionOnly(question: PipelineQuestion, result: ItemResult<MarkOutput> | null): boolean {
  if (!result) return false;
  const combined = combineEvidence(question, verdictOf(inputOf(question), result));
  return combined.evidence.length === 1 && combined.evidence[0] === 'vision_mark';
}

/** The letter one reading gave, or undefined when it gave none. */
const letterOf = (result: ItemResult<MarkOutput> | null | undefined) =>
  result && 'output' in result ? result.output.letter : undefined;

/**
 * Asks the other model, independently, about every question only the vision mark decides; the
 * same letter twice confirms it. A different letter or no reply leaves it held for review.
 */
async function secondReading(
  deps: EvidenceDeps,
  shown: Shown,
  run: LessonRun<MarkOutput>,
  options: EvidenceOptions,
): Promise<{ run: LessonRun<MarkOutput>; confirmed: Set<number> }> {
  const asked = shown.questions.flatMap((q, i) =>
    visionOnly(q, run.results[i] ?? null) ? [i] : [],
  );
  const confirmed = new Set<number>();
  let usage = run.usage;
  let paused = run.paused;
  const strong = modelFor(markLesson.id, deps.providerKind, 'strong');
  for (const tier of ['strong', 'light'] as const) {
    // The other model than the one that gave the first reading.
    const group = asked.filter((i) => (modelOf(run.results[i]) === strong) === (tier === 'light'));
    if (group.length === 0 || paused) continue;
    const items = group.map((i) => shown.items[i] as LessonItem<MarkInput>);
    const again = await runLesson({ ...deps, startTier: tier }, markLesson, items, options);
    group.forEach((i, k) => {
      const first = letterOf(run.results[i]);
      if (first !== undefined && first === letterOf(again.results[k])) confirmed.add(i);
    });
    usage = [...usage, ...again.usage];
    paused = again.paused;
  }
  return { run: { ...run, usage, paused }, confirmed };
}

const modelOf = (result: ItemResult<MarkOutput> | null | undefined) =>
  result && 'model' in result ? result.model : null;

function markList(shown: Shown, run: LessonRun<MarkOutput>, confirmed: ReadonlySet<number>) {
  return shown.questions.flatMap((question, index) => {
    const result = run.results[index];
    if (!result) return [];
    const verdict = verdictOf(inputOf(question), result);
    const sure = confirmed.has(index) && verdict !== null && verdict !== 'review';
    return [
      {
        key: question.key,
        verdict: sure ? { mark: { ...verdict.mark, confirmed: true } } : verdict,
      },
    ];
  });
}

/**
 * Asks D4.mark where needed and combines each question's evidence. A full subscription pauses
 * the run: the unfinished questions come back unchanged and resume later from the step cache.
 */
export async function withEvidence(
  deps: EvidenceDeps,
  file: string,
  questions: readonly PipelineQuestion[],
  options: EvidenceOptions = {},
): Promise<EvidenceRun> {
  const chosen = questionsToAsk(questions, options.auditEvery);
  const shown = await showable(deps, file, chosen.asked, options);
  const first = await runLesson(deps, markLesson, shown.items, options);
  const checked = await recheckSheets(deps, shown, first, options);
  const { run, confirmed } = await secondReading(deps, shown, checked, options);
  const marks = markList(shown, run, confirmed);
  const markByKey = new Map(marks.map((mark) => [mark.key, mark.verdict]));
  const asked = shown.questions.map((question) => question.key);
  const unfinished = new Set(asked.filter((key) => !markByKey.has(key)));
  const updated = questions.map((question) =>
    unfinished.has(question.key)
      ? question
      : combineEvidence(question, markByKey.get(question.key) ?? null),
  );
  const audited = new Set(chosen.audited.map((question) => question.key));
  return {
    questions: updated,
    usage: run.usage,
    asked,
    audited: asked.filter((key) => audited.has(key)),
    marks,
    paused: run.paused,
    resumeAfter: run.resumeAfter,
    failure: run.failure,
  };
}
