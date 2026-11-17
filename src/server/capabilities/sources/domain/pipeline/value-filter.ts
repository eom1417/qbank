// M34 P5: the value filter (curriculum level 5, Q56–Q58). From what a question owns beyond its
// stem and options, keep what explains the answer: the file's explanation text verbatim (cut at
// a sentence end when it is long), and figures, tables and handwriting, the nearest first. Marks,
// filler and anything unsure are left out: the explanation is optional, doubt means drop.
import type { PipelinePicture, PipelineQuestion } from './question.js';

/** The explanation keeps at most this many words. */
export const EXPLANATION_WORDS = 400;
/** Explanation pictures kept per question: images (figures, handwriting) and tables. */
const MAX_IMAGES = 3;
const MAX_TABLES = 2;

/** Classes worth showing after the reveal; text pictures already became explanation text. */
const IMAGE_CLASSES = new Set<PipelinePicture['imageClass']>([
  'figure',
  'handwriting',
  'handwriting_ink',
]);

/** A sentence ends at . ! ? or ؟ before a space or the end, or at a line break. */
const SENTENCE_END = /[.!?؟](?=\s|$)|\n/g;

/**
 * The explanation as printed when it is short enough; else its first sentences within the limit,
 * or its first `EXPLANATION_WORDS` words when no sentence ends in time. Never a cut word.
 */
export function trimExplanation(text: string | null): string | null {
  if (text === null || text.trim() === '') return null;
  const words = [...text.matchAll(/\S+/g)];
  const last = words[EXPLANATION_WORDS - 1];
  if (words.length <= EXPLANATION_WORDS || !last) return text;
  const limit = last.index + last[0].length;
  let cut = limit;
  let sentence = 0;
  for (const end of text.matchAll(SENTENCE_END)) {
    const at = end.index + end[0].length;
    if (at > limit) break;
    sentence = at;
  }
  if (sentence > 0) cut = sentence;
  return text.slice(0, cut).trimEnd();
}

/** How far a picture is from the question's area: pages first, then the vertical gap. */
function distance(question: PipelineQuestion, picture: PipelinePicture): number {
  const anchor = question.area.at(-1) ?? { page: question.page, box: null };
  const pages = Math.abs(picture.spot.page - anchor.page);
  const gap = anchor.box ? Math.abs(picture.spot.box.y0 - anchor.box.y1) : 0;
  return pages * 100_000 + gap;
}

/** The explanation pictures worth keeping, within the limits, nearest first. */
function keptExplanation(question: PipelineQuestion, pictures: readonly PipelinePicture[]) {
  const nearest = [...pictures].sort((a, b) => distance(question, a) - distance(question, b));
  const tables = nearest.filter((picture) => picture.imageClass === 'table');
  const images = nearest.filter((picture) => IMAGE_CLASSES.has(picture.imageClass));
  return new Set([...tables.slice(0, MAX_TABLES), ...images.slice(0, MAX_IMAGES)]);
}

/**
 * The question with only valuable explanation parts. Its own, its options' and its case's
 * pictures are never dropped here; everything else of the question is unchanged.
 */
export function filterValue(question: PipelineQuestion): PipelineQuestion {
  const explained = question.pictures.filter((picture) => picture.placement === 'explanation');
  const kept = keptExplanation(question, explained);
  return {
    ...question,
    explanation: trimExplanation(question.explanation),
    pictures: question.pictures.filter(
      (picture) => picture.placement !== 'explanation' || kept.has(picture),
    ),
  };
}
