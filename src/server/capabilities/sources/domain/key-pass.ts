import { optionLabel, questionLabel } from './labels.js';
import type { TextLine } from './lines.js';
import {
  explanationStart,
  inlineAnswer,
  isKeyHeading,
  keyEntries,
  type KeyEntry,
} from './key-lines.js';

/** Something found between question lines, tied to the last question line before it. */
interface Anchored {
  /** The last line kept for questions before it; null at the very start. */
  after: TextLine | null;
}

interface InlineKey extends Anchored {
  letters: string[];
}

interface Explanation extends Anchored {
  text: string;
}

interface KeySection extends Anchored {
  entries: KeyEntry[];
}

export interface SeparatedLines {
  /** Lines left for the question parser. */
  lines: TextLine[];
  inline: InlineKey[];
  explanations: Explanation[];
  keys: KeySection[];
}

/** A line of three or more entries is a key even without a heading ("1-A 2-C 3-B"). */
const MIN_BARE_ENTRIES = 3;

type Mode = 'questions' | 'key' | 'explanation';

interface PassState extends SeparatedLines {
  mode: Mode;
  after: TextLine | null;
  explainAfterKey: boolean;
  /** The last question number seen among the question lines (M38). */
  lastNumber: number | null;
  /** The lines of the open explanation, as read (M38: a question may hide at its end). */
  explained: TextLine[];
}

export interface SeparateOptions {
  /**
   * What follows an inline answer is its explanation, up to the next question (M38): a file
   * nobody wrote on prints "Correct Answer: D" then the explanation. Off for annotated notes,
   * whose next question may follow the answer with no number.
   */
  explainAfterKey?: boolean;
}

/** In a key or an explanation, the next question's label ends it. */
function leaves(state: PassState, line: TextLine): boolean {
  if (state.mode === 'key') return keyEntries(line.text) === null;
  return nextQuestion(state, line) || isKeyHeading(line.text);
}

/**
 * The line starts a question. After a printed answer (M38) a bare "1." inside the explanation
 * is a list, not a question, unless it is the number after the last question's.
 */
function nextQuestion(state: PassState, line: TextLine): boolean {
  const label = questionLabel(line.text);
  if (!label) return false;
  if (!state.explainAfterKey || label.prefixed || state.lastNumber === null) return true;
  return label.number === state.lastNumber + 1;
}

/** Continues the open key or explanation with this line; false when the line is not part of it. */
function continueOpen(state: PassState, line: TextLine): boolean {
  if (state.mode === 'questions' || leaves(state, line)) {
    state.mode = 'questions';
    return false;
  }
  if (state.mode === 'key') state.keys.at(-1)?.entries.push(...(keyEntries(line.text) ?? []));
  else {
    const open = state.explanations.at(-1);
    if (open) open.text = open.text ? `${open.text} ${line.text}` : line.text;
    state.explained.push(line);
  }
  return true;
}

/** Starts a key, an inline answer or an explanation at this line; false for question lines. */
function startSpecial(state: PassState, line: TextLine): boolean {
  const { after } = state;
  const entries = keyEntries(line.text);
  if (isKeyHeading(line.text) || (entries && entries.length >= MIN_BARE_ENTRIES)) {
    state.keys.push({ after, entries: isKeyHeading(line.text) ? [] : (entries ?? []) });
    state.mode = 'key';
    return true;
  }
  const letters = inlineAnswer(line.text);
  if (letters && letters.length > 0) {
    state.inline.push({ after, letters });
    if (state.explainAfterKey) {
      state.explanations.push({ after, text: '' });
      state.explained = [];
      state.mode = 'explanation';
    }
    return true;
  }
  const explanation = explanationStart(line.text);
  if (explanation === null) return false;
  state.explanations.push({ after, text: explanation });
  state.mode = 'explanation';
  return true;
}

/** How far below an "A." line its "B." may follow for the two to be a question's options. */
const OPTIONS_AHEAD = 4;

/**
 * An "A." line inside an explanation, a "B." soon after it: a question the book printed with
 * no label (M38). Only after a printed answer, where explanations are known to end.
 */
function opensUnlabelled(state: PassState, lines: readonly TextLine[], at: number): boolean {
  const line = lines[at];
  if (!line || !state.explainAfterKey || state.mode !== 'explanation') return false;
  if (optionLabel(line.text)?.index !== 0) return false;
  return lines
    .slice(at + 1, at + 1 + OPTIONS_AHEAD)
    .some((next) => optionLabel(next.text)?.index === 1);
}

/**
 * Gives the unlabelled question its text back from the explanation (the lines on its own
 * page), numbered after the last question: the label line is the reader's, not the book's.
 */
function reopenAsQuestion(state: PassState, first: TextLine) {
  const stem: TextLine[] = [];
  while (state.explained.at(-1)?.page === first.page)
    stem.unshift(state.explained.pop() as TextLine);
  const open = state.explanations.at(-1);
  const taken = stem.map((line) => line.text).join(' ');
  if (open && taken) open.text = open.text.slice(0, open.text.length - taken.length).trimEnd();
  const number = (state.lastNumber ?? 0) + 1;
  const anchor = stem[0] ?? first;
  state.lines.push({ ...anchor, text: `Question: ${number}`, words: anchor.words.slice(0, 1) });
  state.lines.push(...stem);
  state.lastNumber = number;
  state.after = stem.at(-1) ?? state.after;
  state.mode = 'questions';
}

/**
 * Takes answer keys (beside a question, or a section at the end of a chapter or the book) and
 * the author's explanations out of the reading lines, so options keep only their own text
 * (FR-07-001, FR-07-009). Each is tied to the last question line before it.
 */
export function separateKeys(
  lines: readonly TextLine[],
  options: SeparateOptions = {},
): SeparatedLines {
  const state: PassState = {
    explainAfterKey: options.explainAfterKey ?? false,
    lastNumber: null,
    explained: [],
    lines: [],
    inline: [],
    explanations: [],
    keys: [],
    mode: 'questions',
    after: null,
  };
  lines.forEach((line, at) => {
    if (opensUnlabelled(state, lines, at)) reopenAsQuestion(state, line);
    if (continueOpen(state, line) || startSpecial(state, line)) return;
    state.lastNumber = questionLabel(line.text)?.number ?? state.lastNumber;
    state.lines.push(line);
    state.after = line;
  });
  return {
    lines: state.lines,
    inline: state.inline,
    explanations: state.explanations,
    keys: state.keys,
  };
}
