import { optionLabel, questionLabel } from '../../domain/labels.js';
import { unionBox, type Box } from '../../domain/page.js';
import type { PipelineEvidence, PipelineOption, Spot } from '../../domain/pipeline/question.js';
import { combineTags, takeTags } from '../../domain/pipeline/tags.js';
import type { DetectedQuestion, Detection, DraftQuestion, Line } from '../contract.js';

// M39 step 7 input: the linked questions as the answers layer takes them (unchanged from M34):
// their words joined from the lines (the AI's OCR corrections in place), spots, answers and the
// reasons a question goes to review.

/** Review reason: the self-check found a doubt in this question. */
export const DETECTION_DOUBT = 'detection_doubt';

class Reader {
  constructor(private readonly detection: Detection) {}

  line(id: number): Line | undefined {
    return this.detection.file.lines[id];
  }

  text(id: number): string {
    return this.detection.corrections.get(id) ?? this.line(id)?.text ?? '';
  }

  /** The lines' words in reading order; the first line without its printed label. */
  join(ids: readonly number[], first?: (text: string) => string): string {
    const texts = ids.map((id, at) => (at === 0 && first ? first(this.text(id)) : this.text(id)));
    return texts
      .map((text) => text.trim())
      .filter(Boolean)
      .join(' ');
  }

  lines(ids: readonly number[]): Line[] {
    return ids.flatMap((id) => this.line(id) ?? []);
  }
}

const withoutQuestionLabel = (text: string) => questionLabel(text)?.text ?? text;
const withoutOptionLabel = (text: string) => optionLabel(text)?.text ?? text;

/** The label line and the stem lines: the question's words before its options. */
const stemIds = (question: DraftQuestion): number[] => [
  ...(question.labelLine === null ? [] : [question.labelLine]),
  ...question.stem,
];

/** The question's own lines: label, stem and options (what a vision lesson looks at). */
const bodyLines = (question: DraftQuestion): number[] => [
  ...stemIds(question),
  ...question.options.flatMap((option) => option.lines),
];

/** One box per page around the question's lines. */
function areaOf(lines: readonly Line[]): Spot[] {
  const pages = [...new Set(lines.map((line) => line.page))];
  return pages.map((page) => ({
    page,
    box: unionBox(lines.filter((line) => line.page === page).map((line) => line.box)),
  }));
}

/** The printed letter's word box: the word the option's first line starts with. */
function optionOf(reader: Reader, option: DraftQuestion['options'][number]): PipelineOption {
  const first = reader.line(option.lines[0] ?? -1);
  const word = first?.words.find((one) => one.text.startsWith(option.label)) ?? first?.words[0];
  const box: Box | undefined = word?.box ?? first?.box;
  return {
    letter: option.letter,
    label: option.label,
    text: takeTags(reader.join(option.lines, withoutOptionLabel)).rest,
    spot: first && box ? { page: first.page, box } : null,
  };
}

function answerOf(question: DraftQuestion) {
  const answer = question.answer;
  const evidence: PipelineEvidence = answer?.from === 'pen_mark' ? 'pen_mark' : 'printed_key';
  return {
    answers: answer?.letters ?? [],
    evidence: answer && answer.letters.length > 0 ? [evidence] : (['none'] as PipelineEvidence[]),
    conflicts: question.conflicts,
  };
}

/** Why the question goes to review, in today's reason strings (domain/pipeline/build-questions). */
function reviewReasons(detection: Detection, question: DraftQuestion, index: number): string[] {
  const reasons: string[] = [];
  if (detection.doubts.some((doubt) => doubt.question === index)) reasons.push(DETECTION_DOUBT);
  if (question.options.length < 2) reasons.push('incomplete_options');
  if (!question.answer || question.answer.letters.length === 0) reasons.push('no_answer');
  if (question.conflicts.length > 0) reasons.push('answer_conflict');
  return reasons;
}

/** The stem, explanation and case texts without tags, and every tag the question carries. */
function textOf(reader: Reader, question: DraftQuestion) {
  const stem = takeTags(reader.join(stemIds(question), withoutQuestionLabel));
  const explanation = takeTags(reader.join(question.explanation));
  const caseText = reader.join(question.caseLines);
  return {
    stem: stem.rest,
    explanation: explanation.rest || null,
    caseText: caseText || null,
    tags: combineTags([question.tags, stem.tags, explanation.tags]),
  };
}

function convert(reader: Reader, question: DraftQuestion, key: (page: number) => string) {
  const lines = reader.lines(bodyLines(question));
  const page = lines[0]?.page ?? question.pictures[0]?.spot.page ?? 0;
  const stemLines = reader.lines(stemIds(question));
  return {
    key: key(page),
    number: question.number,
    page,
    pages: [...new Set(lines.map((line) => line.page))],
    options: question.options.map((option) => optionOf(reader, option)),
    area: areaOf(lines),
    ...textOf(reader, question),
    pictures: question.pictures,
    ...answerOf(question),
    fromPicture: stemLines.length > 0 && stemLines.every((line) => line.source === 'picture'),
  };
}

/** Every linked question of the file as the answers layer takes it. */
export function toDetectedQuestions(detection: Detection): DetectedQuestion[] {
  const reader = new Reader(detection);
  const seen = new Map<string, number>();
  const keyOf = (number: number) => (page: number) => {
    const base = `${page}-${number}`;
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return `${base}-${occurrence}`;
  };
  return detection.questions.map((question, index) => ({
    ...convert(reader, question, keyOf(question.number)),
    reviewReasons: reviewReasons(detection, question, index),
  }));
}
