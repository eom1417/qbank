import { answerLetter, type OptionSystem } from '../../domain/labels.js';
import type { FileLines, Line, LineRole, Role } from '../contract.js';
import { startOf, type Measure } from './geometry.js';
import type { Signals } from './signals.js';

// M39 step 3: the reading state the role rules carry from one line to the next.

/**
 * Where the reading is: before any question, in a stem, in its options, in text after its
 * options at a block's distance, in an explanation (after a printed answer), or in a key.
 */
export type Mode = 'none' | 'stem' | 'option' | 'after' | 'explanation' | 'key';

export interface Walk {
  file: FileLines;
  measure: Measure;
  signals: Signals[];
  roles: LineRole[];
  mode: Mode;
  /** The number of the last question started (printed or inferred). */
  last: number | null;
  system: OptionSystem | null;
  /** Options read in the current question; the next must be this index. */
  options: number;
  letter: string | null;
  /** Where the current option's first line starts (reading direction); null before one. */
  optionStart: number | null;
  hasStem: boolean;
  /** The current question's label was read in a picture (a pasted screenshot). */
  fromPicture: boolean;
  /** The last page of the last question whose label is the file's own text; null before one. */
  textPage: number | null;
  /** The line before, filler and notes left out. */
  above: Line | undefined;
}

export function startWalk(file: FileLines, measure: Measure, signals: Signals[]): Walk {
  const walk = { file, measure, signals, roles: [], mode: 'none' as const, last: null };
  const rest = { system: null, options: 0, letter: null, optionStart: null, hasStem: false };
  const pictures = { fromPicture: false };
  const text = { textPage: null };
  return { ...walk, ...rest, ...pictures, ...text, above: undefined };
}

export const roleOf = (
  line: Line,
  role: Role,
  confidence: number,
  extra: Partial<LineRole> = {},
): LineRole => ({ line: line.id, role, confidence, ...extra });

/** The reading is inside a question that may still take options. */
export const inQuestion = (walk: Walk) =>
  walk.mode === 'stem' || walk.mode === 'option' || walk.mode === 'after';

/** A question starts: its options and stem start empty. */
export function openQuestion(walk: Walk, number: number, hasStem: boolean): void {
  walk.last = number;
  walk.mode = 'stem';
  walk.system = null;
  walk.options = 0;
  walk.letter = null;
  walk.optionStart = null;
  walk.hasStem = hasStem;
}

/** The next option in the sequence (A, B, C…). */
export function takeOption(walk: Walk, line: Line, confidence: number): LineRole {
  const letter = answerLetter(walk.options);
  walk.options += 1;
  walk.letter = letter;
  walk.optionStart = startOf(line);
  walk.mode = 'option';
  return roleOf(line, 'option', confidence, { letter });
}

/**
 * A question printed in a picture on the last page of a typed question, or the page after it, is
 * an excerpt of another book pasted as its explanation, not a question of the file (M34 D6.1).
 */
export const excerpt = (walk: Walk, line: Line) =>
  line.source === 'picture' && walk.textPage !== null && line.page <= walk.textPage + 1;

const OWN_TEXT: ReadonlySet<Role> = new Set(['stem', 'option', 'answer', 'explanation']);

/** A typed question's own text on a later page carries its last page there. */
export function followText(walk: Walk, line: Line, role: LineRole): void {
  if (walk.textPage === null || walk.fromPicture || line.source === 'picture') return;
  if (OWN_TEXT.has(role.role)) walk.textPage = Math.max(walk.textPage, line.page);
}
