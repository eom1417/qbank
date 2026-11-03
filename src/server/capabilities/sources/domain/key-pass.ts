import { questionLabel } from './labels.js';
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

export interface InlineKey extends Anchored {
  letters: string[];
}

export interface Explanation extends Anchored {
  text: string;
}

export interface KeySection extends Anchored {
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
}

/** In a key or an explanation, the next question's label ends it. */
function leaves(state: PassState, line: TextLine): boolean {
  if (state.mode === 'key') return keyEntries(line.text) === null;
  return questionLabel(line.text) !== null || isKeyHeading(line.text);
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
    return true;
  }
  const explanation = explanationStart(line.text);
  if (explanation === null) return false;
  state.explanations.push({ after, text: explanation });
  state.mode = 'explanation';
  return true;
}

/**
 * Takes answer keys (beside a question, or a section at the end of a chapter or the book) and
 * the author's explanations out of the reading lines, so options keep only their own text
 * (FR-07-001, FR-07-009). Each is tied to the last question line before it.
 */
export function separateKeys(lines: readonly TextLine[]): SeparatedLines {
  const state: PassState = {
    lines: [],
    inline: [],
    explanations: [],
    keys: [],
    mode: 'questions',
    after: null,
  };
  for (const line of lines) {
    if (continueOpen(state, line) || startSpecial(state, line)) continue;
    state.lines.push(line);
    state.after = line;
  }
  return {
    lines: state.lines,
    inline: state.inline,
    explanations: state.explanations,
    keys: state.keys,
  };
}
