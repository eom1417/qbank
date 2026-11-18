import {
  inlineAnswer,
  isDoubtfulKey,
  isKeyHeading,
  keyEntries,
  explanationStart,
} from '../../domain/key-lines.js';
import type { KeyEntry } from '../../domain/key-lines.js';
import {
  circledLabel,
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
  /** The text after a circled letter OCR read as a symbol ("@)Tricuspid"), or null. */
  circled: string | null;
  /** A table row's first cell: one letter alone, a cell gap after it (as A, B, C…). */
  rowLetter: string | null;
  /** A capital letter alone or with a comma before more words ("B Call…", "E, Give…"). */
  looseLetter: string | null;
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

/** A cell separator may be compact, but exceeds the row's ordinary spaces. */
function rowGap(line: Line, measure: Measure): number {
  const gaps = line.words
    .slice(2)
    .flatMap((word, index) => {
      const previous = line.words[index + 1];
      if (!previous) return [];
      const gap = line.rtl ? previous.box.x0 - word.box.x1 : word.box.x0 - previous.box.x1;
      return gap > 0 ? [gap] : [];
    })
    .sort((a, b) => a - b);
  const ordinary = gaps[Math.floor(gaps.length / 2)];
  return ordinary === undefined ? measure.cell : Math.min(measure.cell, ordinary * 2);
}

function rowLetter(line: Line, measure: Measure): string | null {
  const first = line.words[0]?.text ?? '';
  if (!/^[A-Ja-j]$/.test(first) || firstWordGap(line) < rowGap(line, measure)) return null;
  return first.toUpperCase();
}

/** A question label; no question is numbered 0 ("Q0)" is OCR noise). */
function questionNumber(text: string): QuestionLabel | null {
  const label = questionLabel(text);
  return label && label.number > 0 ? label : null;
}

function looseLetter(line: Line): string | null {
  const [first, second] = line.words;
  const letter = /^([A-J])[,;:]?$/.exec(first?.text ?? '')?.[1];
  return letter && second ? letter : null;
}

/** No letter and no digit: a stray bracket, comma or rule carries no words of the text. */
const wordless = (text: string) => !/[\p{L}\p{N}]/u.test(text);

function signalOf(line: Line, measure: Measure, filler: boolean): Signals {
  const text = line.text.trim();
  return {
    filler: filler || wordless(text),
    note: line.deviceNote,
    tag: isTagLine(text),
    heading: isSectionLine(text) || HEADING_WORD.test(text),
    keyHeading: isKeyHeading(text),
    entries: keyEntries(text),
    answer: inlineAnswer(text),
    doubtful: isDoubtfulKey(text),
    explanation: explanationStart(text) !== null,
    label: questionNumber(text),
    option: optionLabel(text),
    circled: circledLabel(text),
    rowLetter: rowLetter(line, measure),
    looseLetter: looseLetter(line),
  };
}

export function signalsOf(file: FileLines, measure: Measure): Signals[] {
  const filler = fillerIds(file);
  return file.lines.map((line) => signalOf(line, measure, filler.has(line.id)));
}
