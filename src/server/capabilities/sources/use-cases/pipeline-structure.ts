// M34 P4b: D6.1 over the pictures the reader left over. Each picture's numbered OCR lines are
// shown to the structure lesson; a picture it calls a question becomes one more question, built
// verbatim by code from the lines it pointed at and placed right after the question before it.
import { createHash } from 'node:crypto';
import type { AiFailure } from '../../providers/index.js';
import { inlineAnswer } from '../domain/key-lines.js';
import {
  buildStructure,
  numberedLines,
  structureLesson,
  type BuiltQuestion,
  type StructureInput,
} from '../domain/pipeline/lessons/structure.js';
import type { Leftover } from '../domain/pipeline/leftover.js';
import type { PipelineQuestion } from '../domain/pipeline/question.js';
import {
  runLesson,
  type LessonDeps,
  type LessonItem,
  type LessonOptions,
  type LessonUsage,
} from './run-lesson.js';

export interface StructureRun {
  /** The file's questions with the new ones inserted; unchanged when nothing was found. */
  questions: PipelineQuestion[];
  /** Keys of the questions built from pictures. */
  found: string[];
  /** Unit ids the lesson could not settle (review reason `structure_unclear`). */
  review: string[];
  usage: LessonUsage[];
  paused: boolean;
  resumeAfter: Date | null;
  failure: AiFailure | null;
}

/** Fewer lines than a stem and two options cannot be a question: not asked. */
const MIN_LINES = 3;

function itemOf(picture: Leftover): LessonItem<StructureInput> {
  const text = numberedLines(picture.lines);
  const fingerprint = createHash('sha256').update(text).digest('hex');
  return { input: { lineCount: picture.lines.length }, fingerprint, image: null, text };
}

/** A printed key among the explanation lines ("Answer: B"), when every letter is an option. */
function printedKey(built: BuiltQuestion): string[] {
  const letters = built.options.map((option) => option.letter);
  for (const line of built.explanationLines) {
    const key = inlineAnswer(line);
    if (key && key.length > 0 && key.every((letter) => letters.includes(letter))) return key;
  }
  return [];
}

function questionOf(picture: Leftover, built: BuiltQuestion): PipelineQuestion {
  const answers = printedKey(built);
  const number = built.number ?? 0;
  return {
    key: `${picture.page}-${number}-${picture.unitId}`,
    number,
    page: picture.page,
    pages: [picture.page],
    stem: built.stem,
    options: built.options.map((option) => ({ ...option, spot: null })),
    area: [{ page: picture.page, box: picture.box }],
    explanation: built.explanation,
    pictures: [],
    answers,
    evidence: answers.length > 0 ? ['printed_key'] : [],
    conflicts: [],
    fromPicture: true,
    caseText: null,
    tags: { exam: null, year: null },
    reviewReasons: [],
  };
}

/** The new questions placed right after the question each picture follows, in picture order. */
export function insertAfter(
  questions: readonly PipelineQuestion[],
  extra: readonly { before: string | null; question: PipelineQuestion }[],
): PipelineQuestion[] {
  const after = (key: string | null) =>
    extra.filter((item) => item.before === key).map((item) => item.question);
  const known = new Set(questions.map((question) => question.key));
  const orphans = extra.filter((item) => item.before !== null && !known.has(item.before));
  return [
    ...after(null),
    ...questions.flatMap((question) => [question, ...after(question.key)]),
    ...orphans.map((item) => item.question),
  ];
}

/**
 * Asks D6.1 about every leftover picture with enough lines. A full subscription pauses the run;
 * what was finished stays in the step cache and the questions come back unchanged.
 */
export async function withStructure(
  deps: LessonDeps,
  questions: readonly PipelineQuestion[],
  leftovers: readonly Leftover[],
  options: LessonOptions = {},
): Promise<StructureRun> {
  const asked = leftovers.filter((picture) => picture.lines.length >= MIN_LINES);
  const run = await runLesson(deps, structureLesson, asked.map(itemOf), options);
  const extra = asked.flatMap((picture, index) => {
    const result = run.results[index];
    const built =
      result?.status === 'answered' ? buildStructure(picture.lines, result.output) : null;
    return built ? [{ before: picture.before, question: questionOf(picture, built) }] : [];
  });
  const review = asked.filter((_, index) => run.results[index]?.status === 'review');
  return {
    questions: run.paused ? [...questions] : insertAfter(questions, extra),
    found: run.paused ? [] : extra.map((item) => item.question.key),
    review: review.map((picture) => picture.unitId),
    usage: run.usage,
    paused: run.paused,
    resumeAfter: run.resumeAfter,
    failure: run.failure,
  };
}
