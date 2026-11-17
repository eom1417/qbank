// M34 P4b: the answer-evidence step. The vision lesson D4.mark is asked only where the code did
// not decide by a printed key (plus a fixed audit sample of keyed questions, to catch hand marks
// that disagree with the key); then every question's signals are combined (D4.6).
import { createHash } from 'node:crypto';
import type { AiFailure } from '../../providers/index.js';
import { combineEvidence, type VisionVerdict } from '../domain/pipeline/evidence.js';
import {
  markedLetters,
  markLesson,
  type MarkInput,
  type MarkOutput,
} from '../domain/pipeline/lessons/mark.js';
import type { PipelineQuestion } from '../domain/pipeline/question.js';
import { cropQuestions, type QuestionCrop } from '../adapters/question-crops.js';
import {
  runLesson,
  type ItemResult,
  type LessonDeps,
  type LessonItem,
  type LessonOptions,
  type LessonUsage,
} from './run-lesson.js';

export interface EvidenceDeps extends LessonDeps {
  /** Renders the questions' areas; the real one renders with poppler. */
  cropQuestions?: (file: string, questions: readonly PipelineQuestion[]) => Promise<QuestionCrop[]>;
}

export interface EvidenceOptions extends LessonOptions {
  /** Every n-th keyed question is also asked, as an audit (10 = a fixed 10%); 0 = none. */
  auditEvery?: number;
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
  const crops = await (deps.cropQuestions ?? cropQuestions)(file, chosen.asked);
  const cropByKey = new Map(crops.map((crop) => [crop.key, crop]));
  const shown = chosen.asked.filter((question) => cropByKey.has(question.key));
  const items = shown.flatMap((question) => {
    const crop = cropByKey.get(question.key);
    return crop ? [itemOf(question, crop)] : [];
  });
  const run = await runLesson(deps, markLesson, items, options);
  const marks = shown.flatMap((question, index) => {
    const result = run.results[index];
    return result ? [{ key: question.key, verdict: verdictOf(inputOf(question), result) }] : [];
  });
  const markByKey = new Map(marks.map((mark) => [mark.key, mark.verdict]));
  const unfinished = new Set(
    shown.map((question) => question.key).filter((key) => !markByKey.has(key)),
  );
  const updated = questions.map((question) => {
    if (unfinished.has(question.key)) return question;
    return combineEvidence(question, markByKey.get(question.key) ?? null);
  });
  return {
    questions: updated,
    usage: run.usage,
    asked: shown.map((question) => question.key),
    audited: chosen.audited.map((question) => question.key).filter((key) => cropByKey.has(key)),
    marks,
    paused: run.paused,
    resumeAfter: run.resumeAfter,
    failure: run.failure,
  };
}
