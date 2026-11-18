import type { Box } from '../page.js';
import type { ImageClass } from './image-class.js';

// M34 P4: one question as the pipeline carries it between its steps (virtual text and placement →
// evidence lessons → value filter → saving). Every word is the source's own (Z2).

export type PicturePlacement = 'question' | 'option' | 'explanation' | 'case';

/** Where something sits on the page, in PDF points. */
export interface Spot {
  page: number;
  box: Box;
}

export interface PipelineOption {
  /** Positional letter (A, B, C…); `label` is what the page printed. */
  letter: string;
  label: string;
  text: string;
  /** The printed letter's spot, when the page has one (for ink and vision evidence). */
  spot: Spot | null;
}

export interface PipelinePicture {
  /** The unit it came from, or `ink:<page>:<n>` for a handwritten note found as ink. */
  unitId: string;
  spot: Spot;
  placement: PicturePlacement;
  optionLetter: string | null;
  imageClass: ImageClass | 'handwriting_ink';
  /** Original embedded resolution, used by the shared quality check. */
  ppi?: number | null;
  /** Whether the region is bracketed by its question's own lines. */
  certain?: boolean;
}

export type PipelineEvidence =
  'printed_key' | 'pen_mark' | 'vision_mark' | 'single_option' | 'explanation_text' | 'none';

export interface PipelineQuestion {
  /** Stable within a file: `${page}-${number}-${occurrence}`. */
  key: string;
  number: number;
  page: number;
  pages: number[];
  stem: string;
  options: PipelineOption[];
  /** From the stem's first line to the last option: what a vision lesson looks at. */
  area: Spot[];
  /** The file's own explanation text, verbatim; null when it has none. */
  explanation: string | null;
  pictures: PipelinePicture[];
  answers: string[];
  evidence: PipelineEvidence[];
  /** Why two signals disagree; any entry sends the question to review. */
  conflicts: string[];
  /** The question was read from a picture of printed words (D6.1). */
  fromPicture: boolean;
  caseText: string | null;
  tags: { exam: string | null; year: string | null };
  reviewReasons: string[];
}
