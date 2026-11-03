import { boxHeight, type Box, type PageWord } from './page.js';
import {
  answerLetter,
  optionLabel,
  questionLabel,
  type OptionLabel,
  type OptionSystem,
} from './labels.js';
import type { TextLine } from './lines.js';

interface ParsedOption {
  /** The answer letter by position (A, B, C…), whatever label the page printed. */
  letter: string;
  /** The label as printed: "A", "b", "ج" or "3". */
  label: string;
  text: string;
  /** Where the option letter is printed: answer marks are looked for around it. */
  letterBox: Box;
  /** The page the option is printed on (it can follow its stem onto the next page). */
  page: number;
  /** OCR read the letter as a circle symbol: the letter was circled by hand. */
  circledGlyph: boolean;
}

export interface ParsedQuestion {
  number: number;
  page: number;
  stem: string;
  options: ParsedOption[];
  /** Where the question label starts (its right edge in Arabic); options must start near it. */
  start: number;
  /** Its label reads right to left: lines of either script line up on its right edge. */
  rtl: boolean;
  /** The label system of its options, once the first option is read. */
  system: OptionSystem | null;
  /** A line at the option start followed the last option: OCR may have lost a circled option. */
  maybeLostOption: boolean;
  /** Where its lines are, page by page: a figure is linked by where it sits (M5.2). */
  spans: { page: number; box: Box }[];
}

// How OCR reads a hand-circled letter ("@)Tricuspid atresia", "© Hypothalamic…", "G)GnRH…").
const CIRCLED = /^(?:[@©®]\)?|G\))\s*(.*)$/;
// "~*~*~*" rules and "Heart Murmurs (4 Questions)" headings close the current question.
const SEPARATOR = /^(?:[~*\s]{6,}|.*\(\d+\s+Questions?\))$/i;
// About 6% of a page width: options may be indented a little relative to their question.
const INDENT_TOLERANCE = 36;
const MAX_GAP_LINES = 1.9;
/** Options sit close together; a lettered line far below is a pasted image or a note. */
const MAX_OPTION_GAP_LINES = 3.5;
/** A handwritten note may sit between the stem and the first option. */
const MAX_FIRST_OPTION_GAP_LINES = 8;

/** A line starting where the question does, on the question's own side (FR-05-002). */
const atQuestionStart = (line: TextLine, question: ParsedQuestion) =>
  Math.abs((question.rtl ? line.box.x1 : line.box.x0) - question.start) <= INDENT_TOLERANCE;

type Element =
  { kind: 'stem'; question: ParsedQuestion } | { kind: 'option'; option: ParsedOption };

/** The label continues the question's options: same system, next in sequence. */
const continuesOptions = (question: ParsedQuestion, label: OptionLabel) =>
  label.index === question.options.length &&
  (question.system === null || question.system === label.system);

/**
 * An option line: printed near the question's start, with the next label in sequence (a label
 * out of sequence is a pasted screenshot or a note, not an option).
 */
function optionFrom(line: TextLine, question: ParsedQuestion): ParsedOption | null {
  const first: PageWord | undefined = line.words[0];
  if (!first || !atQuestionStart(line, question)) return null;
  const index = question.options.length;
  const base = { letterBox: first.box, page: line.page, letter: answerLetter(index) };
  const label = optionLabel(line.text);
  if (label) {
    if (!continuesOptions(question, label)) return null;
    question.system = label.system;
    return { ...base, label: label.label, text: label.text, circledGlyph: false };
  }
  const circled = question.system === 'arabic' ? null : CIRCLED.exec(line.text);
  return circled
    ? { ...base, label: answerLetter(index), text: circled[1] ?? '', circledGlyph: true }
    : null;
}

/**
 * A question line. Prefixed numbers ("Q3)", "س3)") always start one; a bare "3." only when it
 * follows the previous question's number and is not the next option of that question.
 */
function questionFrom(line: TextLine, previous: ParsedQuestion | undefined): ParsedQuestion | null {
  const label = questionLabel(line.text);
  if (!label) return null;
  if (!label.prefixed && previous) {
    const option = optionLabel(line.text);
    if (option && continuesOptions(previous, option)) return null;
    if (label.number !== previous.number + 1) return null;
  }
  return {
    number: label.number,
    page: line.page,
    stem: label.text,
    options: [],
    start: line.start,
    rtl: line.rtl,
    system: null,
    maybeLostOption: false,
    spans: [{ page: line.page, box: line.box }],
  };
}

const appendText = (current: string, more: string) => (current ? `${current} ${more}` : more);

/** A figure or table on a page: the space it takes is not a gap between lines (M5). */
export interface PlacedFigure {
  page: number;
  box: Box;
}

/** Height of the figures lying between two lines of a page. */
const figureHeightBetween = (
  figures: readonly PlacedFigure[],
  above: Box,
  below: Box,
  page: number,
) =>
  figures
    .filter((figure) => figure.page === page && figure.box.y0 >= above.y1 - 1)
    .filter((figure) => figure.box.y1 <= below.y0 + 1)
    .reduce((sum, figure) => sum + (figure.box.y1 - figure.box.y0), 0);

function within(
  previous: TextLine | null,
  line: TextLine,
  lines: number,
  figures: readonly PlacedFigure[],
): boolean {
  if (!previous) return false;
  // Text runs on to the next page, never over a page that could not be read.
  if (previous.page !== line.page) return line.page === previous.page + 1;
  const gap =
    line.box.y0 - previous.box.y1 - figureHeightBetween(figures, previous.box, line.box, line.page);
  return gap <= boxHeight(previous.box) * lines;
}

/** The last line appended as a continuation, and the text it was appended to. */
interface Continuation {
  line: TextLine;
  element: Element;
  textBefore: string;
}

interface ParseState {
  questions: ParsedQuestion[];
  open: Element | null;
  previous: TextLine | null;
  continuation: Continuation | null;
  /** The last line that belonged to the current question. */
  lastOfQuestion: TextLine | null;
  /** A page was skipped (not read): numbering may resume at any number. */
  afterSkippedPage: boolean;
  figures: readonly PlacedFigure[];
}

const elementText = (element: Element) =>
  element.kind === 'stem' ? element.question.stem : element.option.text;

function setElementText(element: Element, text: string) {
  if (element.kind === 'stem') element.question.stem = text;
  else element.option.text = text;
}

/**
 * OCR can lose a circled letter completely ("C. Hyperkalemia" → "yperkalemia"). When the next
 * typed letter skips exactly one and a single line was just taken as a continuation, that line
 * was the missing option: it is moved back out and marked as circled.
 */
function recoverLostOption(state: ParseState, line: TextLine, question: ParsedQuestion) {
  const skipped = question.options.length;
  const next = optionLabel(line.text);
  const { continuation } = state;
  if (!continuation || !next || next.index !== skipped + 1) return;
  if (question.system !== null && question.system !== next.system) return;
  const lost = continuation.line;
  if (!atQuestionStart(lost, question)) return;
  setElementText(continuation.element, continuation.textBefore);
  const letterBox = lost.words[0]?.box ?? lost.box;
  question.options.push({
    letter: answerLetter(skipped),
    label: answerLetter(skipped),
    text: lost.text,
    letterBox,
    page: lost.page,
    circledGlyph: true,
  });
}

function appendContinuation(state: ParseState, open: Element, line: TextLine) {
  const question = state.questions[state.questions.length - 1];
  if (open.kind === 'option' && question && atQuestionStart(line, question)) {
    question.maybeLostOption = true;
  }
  question?.spans.push({ page: line.page, box: line.box });
  const textBefore = elementText(open);
  setElementText(open, appendText(textBefore, line.text));
  state.continuation = { line, element: open, textBefore };
}

/** The line as the question's next option, when it is one and close enough to the question. */
function acceptOption(state: ParseState, line: TextLine, question: ParsedQuestion): Element | null {
  const gap = question.options.length ? MAX_OPTION_GAP_LINES : MAX_FIRST_OPTION_GAP_LINES;
  const near = within(state.lastOfQuestion, line, gap, state.figures);
  const option = near ? optionFrom(line, question) : null;
  if (!option) return null;
  question.options.push(option);
  question.spans.push({ page: line.page, box: line.box });
  state.lastOfQuestion = line;
  return { kind: 'option', option };
}

/** The line as the start of a new question, when it is one. */
function startQuestion(state: ParseState, line: TextLine): Element | null {
  if (state.previous && line.page > state.previous.page + 1) state.afterSkippedPage = true;
  const last = state.afterSkippedPage ? undefined : state.questions[state.questions.length - 1];
  const question = questionFrom(line, last);
  if (!question) return null;
  state.afterSkippedPage = false;
  state.questions.push(question);
  state.lastOfQuestion = line;
  return { kind: 'stem', question };
}

/** Applies one reading line: a new question, a new option, more text, or the end of an element. */
function step(state: ParseState, line: TextLine): Element | null {
  const continuation = state.continuation;
  state.continuation = null;
  const started = startQuestion(state, line);
  if (started) return started;
  const current = state.questions[state.questions.length - 1];
  if (current) {
    state.continuation = continuation;
    recoverLostOption(state, line, current);
    state.continuation = null;
  }
  const option = current ? acceptOption(state, line, current) : null;
  if (option) return option;
  const { open } = state;
  if (!open || SEPARATOR.test(line.text)) return null;
  if (!within(state.previous, line, MAX_GAP_LINES, state.figures)) return null;
  appendContinuation(state, open, line);
  state.lastOfQuestion = line;
  return open;
}

/**
 * Reads typed multiple-choice questions ("Q12) …" then "A. …") from reading lines across pages.
 * Anything else (headings, pasted explanations, notes) only ends the current element.
 */
export function parseQuestions(
  lines: readonly TextLine[],
  figures: readonly PlacedFigure[] = [],
): ParsedQuestion[] {
  const state: ParseState = {
    questions: [],
    open: null,
    previous: null,
    continuation: null,
    lastOfQuestion: null,
    afterSkippedPage: false,
    figures,
  };
  for (const line of lines) {
    state.open = step(state, line);
    state.previous = line;
  }
  return state.questions;
}
