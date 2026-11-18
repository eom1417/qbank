import type { FileUnits } from '../adapters/pipeline-units.js';
import type { Box, PageText, PageWord } from '../domain/page.js';
import type { PipelinePicture, PipelineQuestion } from '../domain/pipeline/question.js';

// M39: the one detection path for any file (docs/plans/m39-detection-system.md). Each step reads
// the one before through these types only; no step knows what kind of file it reads.

/** Where a line's words came from: the PDF text layer, OCR of a scanned page, or a picture. */
export type LineSource = 'text' | 'ocr' | 'picture';

/** One reading line of the file; `id` is its index in `FileLines.lines` (reading order). */
export interface Line {
  id: number;
  page: number;
  box: Box;
  text: string;
  words: PageWord[];
  source: LineSource;
  /** The unit (text line or picture) the line belongs to. */
  unitId: string;
  rtl: boolean;
  /** OCR confidence 0–100 for OCR and picture lines; null for the text layer. */
  confidence: number | null;
  /** Typed on a device over the page (a note font such as ".SFUI"): kept, never a question part. */
  deviceNote: boolean;
}

/** The file's own spacing, measured from its lines: no step uses a fixed distance. */
export interface Layout {
  /** Median line height, in points. */
  lineHeight: number;
  /** Median gap between consecutive lines of one paragraph, in points. */
  lineGap: number;
  /** Typical gap between paragraphs, in points. */
  paragraphGap: number;
  /** Most common left edge of text lines, per page (RTL: right edge). */
  margins: Map<number, number>;
}

/** Step 1–2 output: every word of the file in exactly one line. */
export interface FileLines {
  lines: Line[];
  units: FileUnits;
  pages: PageText[];
  layout: Layout;
}

export type Role =
  | 'label' // a question's number line ("Question: 2", "12.", "Q3)")
  | 'stem'
  | 'option'
  | 'answer' // a printed answer for one question ("Correct Answer: D", "Ans: B")
  | 'key_table' // an answer-key section's line ("1-A 2-C", "Answers", "1. B")
  | 'explanation'
  | 'case' // a case or shared text above several questions
  | 'tag' // exam or year tag
  | 'heading' // section or chapter heading
  | 'filler' // running header, footer, page number, watermark
  | 'note' // the reader's own note (device text, handwriting read as text)
  | 'unknown';

export interface LineRole {
  line: number;
  role: Role;
  /** label: the printed number; key_table: the entries' numbers. */
  number?: number;
  /** option: its positional letter (A, B…); answer: the letters it names. */
  letter?: string;
  letters?: string[];
  /** key_table: number → letters, as printed. */
  entries?: { number: number; letters: string[] }[];
  /** 0–1: how sure the rule is; below 0.5 the line is a doubt for step 5. */
  confidence: number;
  /** Set by the AI step: the role came from the model, not the rules. */
  byModel?: boolean;
}

/** Step 4 output: a question as line ids, before any text is joined. */
export interface DraftQuestion {
  number: number;
  /** The file printed no number: it was inferred from the questions around it. */
  numberInferred: boolean;
  labelLine: number | null;
  stem: number[];
  options: { letter: string; label: string; lines: number[] }[];
  answer: {
    letters: string[];
    lines: number[];
    from: 'inline' | 'key_table' | 'pen_mark' | 'single_option';
  } | null;
  /** Signals that disagree about the answer (a key against a pen mark…): review. */
  conflicts: string[];
  explanation: number[];
  caseLines: number[];
  pictures: PipelinePicture[];
  tags: { exam: string | null; year: string | null };
}

export type CheckId =
  | 'number'
  | 'stem'
  | 'option_sequence'
  | 'option_holds_other'
  | 'answer_in_options'
  | 'explanation_holds_question'
  | 'parts_in_order'
  | 'picture_place'
  | 'case_link'
  | 'coverage'
  | 'numbering'
  | 'key_use';

/** Step 5 output: one place the detection is not sure of, with its lines. */
export interface Doubt {
  check: CheckId;
  /** Index into the questions, or null for a file-level doubt (coverage, numbering, keys). */
  question: number | null;
  lines: number[];
  detail: string;
}

export interface Detection {
  file: FileLines;
  roles: LineRole[];
  questions: DraftQuestion[];
  doubts: Doubt[];
  /** OCR words the AI corrected (step 6): line id → corrected text; the original stays in lines. */
  corrections: Map<number, string>;
}

export type StepId = 'inspect' | 'read' | 'roles' | 'link' | 'check' | 'assist' | 'save';
export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed';

/** What the import card shows for one step (M39 §5). */
export interface StepReport {
  step: StepId;
  status: StepStatus;
  done: number;
  total: number;
  /** A short count or reason the card shows next to the step ("71 questions", "3 doubts"). */
  note: string | null;
}

export type OnStep = (report: StepReport) => Promise<void>;

/** The questions saved and passed on to the answers layer, unchanged from M34. */
export type DetectedQuestion = PipelineQuestion;
