import type { AnswerConflict, AnswerEvidence } from '../domain/answer-decision.js';
import type { Box, PageText } from '../domain/page.js';
import type { PlacedFigure } from '../domain/questions.js';
import { rasterCache } from '../adapters/raster.js';
import { detectReadPages } from './detection-compat.js';
export { rasterCache } from '../adapters/raster.js';

/** `text`: the PDF's text layer (OCR only where it is unreadable). `ocr`: render and OCR every page, as for a scanned file. */
export type ReadingMode = 'text' | 'ocr';

export interface ExtractedQuestion {
  number: number;
  page: number;
  stem: string;
  /** A question with no options is an essay question (FR-05-010); it has no answer key here. */
  kind: 'mcq' | 'essay';
  /** `letter` is positional (A, B, C…); `label` is what the page printed (A, ب, 3). */
  options: { letter: string; label: string; text: string }[];
  /** Null when nothing in the source decides it: the question goes to review, never a guess. */
  answer: string | null;
  /** Every right option; several only for a multiple-select question (FR-07-008). */
  answers: string[];
  /** `ai_read` and `ai_mark` come only from the user's AI reading the page, never from the rules. */
  evidence: AnswerEvidence | null;
  /** Key, pen mark and explanation disagree: held for review (FR-07-005). */
  conflicts: AnswerConflict[];
  /** The stem asks for several answers ("select two", DEC-05). */
  multiSelect: boolean;
  /** The author's own explanation, kept apart from anything generated (FR-07-009). */
  explanation: string | null;
  /** Where its lines are on each page, to link figures by position (M5.2). */
  spans: { page: number; box: Box }[];
}

/** The established page-reader entrypoint, now owned by the line-role detection pipeline. */
export function questionsFromPages(
  file: string,
  pages: readonly PageText[],
  raster = rasterCache(file),
  figures: readonly PlacedFigure[] = [],
): Promise<ExtractedQuestion[]> {
  return detectReadPages(file, pages, raster, figures);
}
