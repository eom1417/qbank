import {
  inlineAnswer,
  isDoubtfulKey,
  isKeyHeading,
  keyEntries,
  explanationStart,
} from '../../domain/key-lines.js';
import type { KeyEntry } from '../../domain/key-lines.js';
import {
  optionLabel,
  questionLabel,
  type OptionLabel,
  type QuestionLabel,
} from '../../domain/labels.js';
import { isTagLine } from '../../domain/pipeline/tags.js';
import { isSectionLine } from '../../domain/questions.js';
import { dropRunningLines } from '../../domain/running-lines.js';
import type { FileLines, Line } from '../contract.js';
import { firstWordGap, toTextLine, type Measure } from './geometry.js';

// M39 step 3: what each line says on its own, before its place in the file decides its role.

export interface Signals {
  filler: boolean;
  note: boolean;
  tag: boolean;
  heading: boolean;
  keyHeading: boolean;
  entries: KeyEntry[] | null;
  answer: string[] | null;
  doubtful: boolean;
  explanation: boolean;
  label: QuestionLabel | null;
  option: OptionLabel | null;
  /** A table row's first cell: one letter alone, a cell gap after it (as A, B, C…). */
  rowLetter: string | null;
}

/** "Chapter 3", "Section B", "الفصل الثاني": a heading in any book. */
const HEADING_WORD = /^(?:chapter|section|unit|الفصل|الباب|الوحدة)\s+\S+(?:\s+\S+){0,6}$/i;

/** Running headers, footers and page numbers, by the page-reading rule. */
function fillerIds(file: FileLines): Set<number> {
  const heights = new Map(file.pages.map((page) => [page.page, page.height]));
  const text = file.lines.map(toTextLine);
  const kept = new Set(dropRunningLines(text, heights));
  return new Set(text.flatMap((line, index) => (kept.has(line) ? [] : [index])));
}

function rowLetter(line: Line, measure: Measure): string | null {
  const first = line.words[0]?.text ?? '';
  if (!/^[A-Ja-j]$/.test(first) || firstWordGap(line) < measure.cell) return null;
  return first.toUpperCase();
}

function signalOf(line: Line, measure: Measure, filler: boolean): Signals {
  const text = line.text.trim();
  return {
    filler,
    note: line.deviceNote,
    tag: isTagLine(text),
    heading: isSectionLine(text) || HEADING_WORD.test(text),
    keyHeading: isKeyHeading(text),
    entries: keyEntries(text),
    answer: inlineAnswer(text),
    doubtful: isDoubtfulKey(text),
    explanation: explanationStart(text) !== null,
    label: questionLabel(text),
    option: optionLabel(text),
    rowLetter: rowLetter(line, measure),
  };
}

export function signalsOf(file: FileLines, measure: Measure): Signals[] {
  const filler = fillerIds(file);
  return file.lines.map((line) => signalOf(line, measure, filler.has(line.id)));
}
