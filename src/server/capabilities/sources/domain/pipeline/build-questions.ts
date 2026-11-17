// M34 P4a: the pipeline's questions put together from what the steps found: the parsed
// question, its decided answer, its placed pictures and notes, its case and its tags.
import type { AnswerEvidence } from '../answer-decision.js';
import { unionBox, type Box } from '../page.js';
import type { ParsedQuestion } from '../questions.js';
import type { Owned, QuestionFrame } from './placement.js';
import type { PipelineEvidence, PipelinePicture, PipelineQuestion, Spot } from './question.js';
import { combineTags, isTagLine, takeTags, type QuestionTags } from './tags.js';
import type { VirtualText } from './virtual-text.js';

/** A question's answer as the rules decided it. */
interface DecidedAnswer {
  answers: string[];
  evidence: AnswerEvidence | null;
  conflicts: string[];
  explanation: string | null;
}

export interface QuestionParts {
  parsed: readonly ParsedQuestion[];
  decided: readonly DecidedAnswer[];
  frames: readonly QuestionFrame[];
  owned: readonly Owned[];
  notes: readonly { question: number; page: number; box: Box }[];
  cases: readonly { questions: number[]; text: string }[];
  /** Questions whose stem was read in a picture. */
  picture: ReadonlySet<number>;
  text: VirtualText;
  /** Orders of the virtual lines no question, key or explanation read. */
  free: ReadonlySet<number>;
}

const EVIDENCE: Record<AnswerEvidence, PipelineEvidence> = {
  answer_key: 'printed_key',
  answer_file: 'printed_key',
  explanation: 'explanation_text',
  pen_mark: 'pen_mark',
  single_option: 'single_option',
  ai_read: 'vision_mark',
  ai_mark: 'vision_mark',
};

/** One box per page around the question's lines (what a vision lesson looks at). */
function areaOf(question: ParsedQuestion): Spot[] {
  const pages = [...new Set(question.spans.map((span) => span.page))];
  return pages.map((page) => ({
    page,
    box: unionBox(question.spans.filter((span) => span.page === page).map((span) => span.box)),
  }));
}

/** Tag lines among the free lines from this question's anchor to the next one's. */
function lineTags(parts: QuestionParts, index: number): QuestionTags[] {
  const from = parts.frames[index]?.stemAt ?? 0;
  const to = parts.frames[index + 1]?.stemAt ?? parts.text.lines.length;
  const tags: QuestionTags[] = [];
  for (let at = from; at < to; at++) {
    const line = parts.text.lines[at]?.line.text ?? '';
    if (parts.free.has(at) && isTagLine(line)) tags.push(takeTags(line).tags);
  }
  return tags;
}

/** Handwritten notes found as ink, numbered per page in file order. */
function notePictures(parts: QuestionParts): PipelinePicture[][] {
  const result: PipelinePicture[][] = parts.parsed.map(() => []);
  const counts = new Map<number, number>();
  for (const note of parts.notes) {
    const n = counts.get(note.page) ?? 0;
    counts.set(note.page, n + 1);
    result[note.question]?.push({
      unitId: `ink:${note.page}:${n}`,
      spot: { page: note.page, box: note.box },
      placement: 'explanation',
      optionLetter: null,
      imageClass: 'handwriting_ink',
    });
  }
  return result;
}

function reviewReasons(question: ParsedQuestion, decided: DecidedAnswer | undefined): string[] {
  const reasons: string[] = [];
  if (question.options.length < 2) reasons.push('incomplete_options');
  if (!decided || decided.answers.length === 0) reasons.push('no_answer');
  if (decided && decided.conflicts.length > 0) reasons.push('answer_conflict');
  return reasons;
}

/** The question's stem and explanation without tags, and every tag it carries. */
function textOf(parts: QuestionParts, index: number) {
  const question = parts.parsed[index] as ParsedQuestion;
  const stem = takeTags(question.stem);
  const pieces = [parts.decided[index]?.explanation, ...(parts.owned[index]?.texts ?? [])];
  const explanation = takeTags(pieces.filter(Boolean).join('\n'));
  const options = question.options.map((option) => takeTags(option.text).tags);
  const tags = combineTags([stem.tags, ...options, explanation.tags, ...lineTags(parts, index)]);
  return { stem: stem.rest, explanation: explanation.rest || null, tags };
}

const answerOf = (decided: DecidedAnswer | undefined) => ({
  answers: decided?.answers ?? [],
  evidence: decided?.evidence ? [EVIDENCE[decided.evidence]] : (['none'] as PipelineEvidence[]),
  conflicts: decided?.conflicts ?? [],
});

/** Every question of the file as the pipeline carries it (P4 → P5). */
export function buildQuestions(parts: QuestionParts): PipelineQuestion[] {
  const notes = notePictures(parts);
  const seen = new Map<string, number>();
  return parts.parsed.map((question, index) => {
    const decided = parts.decided[index];
    const base = `${question.page}-${question.number}`;
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return {
      key: `${base}-${occurrence}`,
      number: question.number,
      page: question.page,
      pages: [...new Set(question.spans.map((span) => span.page))],
      options: question.options.map(({ letter, label, text, page, letterBox }) => ({
        letter,
        label,
        text: takeTags(text).rest,
        spot: { page, box: letterBox },
      })),
      area: areaOf(question),
      ...textOf(parts, index),
      pictures: [...(parts.owned[index]?.pictures ?? []), ...(notes[index] ?? [])],
      ...answerOf(decided),
      fromPicture: parts.picture.has(index),
      caseText: parts.cases.find((c) => c.questions.includes(index))?.text ?? null,
      reviewReasons: reviewReasons(question, decided),
    };
  });
}
