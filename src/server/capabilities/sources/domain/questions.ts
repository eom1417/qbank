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
  /** The label system of its options, once the first option is read. */
  system: OptionSystem | null;
  /** A line at the option start followed the last option: OCR may have lost a circled option. */
  maybeLostOption: boolean;
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
  if (!first || Math.abs(line.start - question.start) > INDENT_TOLERANCE) return null;
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
    system: null,
    maybeLostOption: false,
  };
}

const appendText = (current: string, more: string) => (current ? `${current} ${more}` : more);

function within(previous: TextLine | null, line: TextLine, lines: number): boolean {
  if (!previous) return false;
  if (previous.page !== line.page) return true;
  return line.box.y0 - previous.box.y1 <= boxHeight(previous.box) * lines;
}

/** True when `line` reads as the continuation of the element that ended at `previous`. */
const continues = (previous: TextLine | null, line: TextLine) =>
  within(previous, line, MAX_GAP_LINES);

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
  if (Math.abs(lost.start - question.start) > INDENT_TOLERANCE) return;
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
  if (
    open.kind === 'option' &&
    question &&
    Math.abs(line.start - question.start) <= INDENT_TOLERANCE
  ) {
    question.maybeLostOption = true;
  }
  const textBefore = elementText(open);
  setElementText(open, appendText(textBefore, line.text));
  state.continuation = { line, element: open, textBefore };
}

/** The line as the question's next option, when it is one and close enough to the question. */
function acceptOption(state: ParseState, line: TextLine, question: ParsedQuestion): Element | null {
  const gap = question.options.length ? MAX_OPTION_GAP_LINES : MAX_FIRST_OPTION_GAP_LINES;
  const option = within(state.lastOfQuestion, line, gap) ? optionFrom(line, question) : null;
  if (!option) return null;
  question.options.push(option);
  state.lastOfQuestion = line;
  return { kind: 'option', option };
}

/** Applies one reading line: a new question, a new option, more text, or the end of an element. */
function step(state: ParseState, line: TextLine): Element | null {
  const question = questionFrom(line, state.questions[state.questions.length - 1]);
  const continuation = state.continuation;
  state.continuation = null;
  if (question) {
    state.questions.push(question);
    state.lastOfQuestion = line;
    return { kind: 'stem', question };
  }
  const current = state.questions[state.questions.length - 1];
  if (current) {
    state.continuation = continuation;
    recoverLostOption(state, line, current);
    state.continuation = null;
  }
  const option = current ? acceptOption(state, line, current) : null;
  if (option) return option;
  const { open } = state;
  if (!open || SEPARATOR.test(line.text) || !continues(state.previous, line)) return null;
  appendContinuation(state, open, line);
  state.lastOfQuestion = line;
  return open;
}

/**
 * Reads typed multiple-choice questions ("Q12) …" then "A. …") from reading lines across pages.
 * Anything else (headings, pasted explanations, notes) only ends the current element.
 */
export function parseQuestions(lines: readonly TextLine[]): ParsedQuestion[] {
  const state: ParseState = {
    questions: [],
    open: null,
    previous: null,
    continuation: null,
    lastOfQuestion: null,
  };
  for (const line of lines) {
    state.open = step(state, line);
    state.previous = line;
  }
  return state.questions;
}
