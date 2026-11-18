import type { OptionSystem } from '../../domain/labels.js';
import type { Line, LineRole } from '../contract.js';
import { gapBetween } from './geometry.js';
import type { Signals } from './signals.js';
import { openQuestion, roleOf, takeOption, type Walk } from './walk.js';

// M39 step 3: a question the file printed with no label. An "A." that opens a new set of options
// (inside an explanation, after a full set, before any question) with "B." soon after starts one;
// its label is inferred (the number after the last) and left in doubt for the checks.

/** How many lines ahead the second option of a new set is looked for. */
const LOOKAHEAD = 8;
const INFERRED = 0.4;

/** Where a first option cannot continue the current question. */
const opensSet = (walk: Walk) =>
  ['none', 'explanation', 'after', 'key'].includes(walk.mode) ||
  (walk.mode === 'option' && walk.options >= 2);

/** "B." in the same system follows within a few lines, before any other question part. */
function secondOptionSoon(walk: Walk, from: number, system: OptionSystem): boolean {
  const end = Math.min(walk.signals.length, from + 1 + LOOKAHEAD);
  for (let id = from + 1; id < end; id++) {
    const signals = walk.signals[id];
    if (!signals || signals.label || signals.answer || signals.keyHeading || signals.heading)
      return false;
    if (signals.option) return signals.option.index === 1 && signals.option.system === system;
  }
  return false;
}

const isFreeText = (role: LineRole) =>
  ['explanation', 'unknown', 'stem'].includes(role.role) ||
  (role.role === 'heading' && role.confidence <= 0.5);

/** The text block right above the first option, on its page: the unlabelled question's stem. */
function stemBlock(walk: Walk, start: Line): number[] {
  const block: number[] = [];
  let below = start;
  for (let id = start.id - 1; id >= 0; id--) {
    const role = walk.roles[id];
    const line = walk.file.lines[id];
    if (!role || !line) break;
    if (role.role === 'filler' || role.role === 'note') continue;
    const limit = block.length === 0 ? walk.measure.block : walk.measure.paragraph;
    if (!isFreeText(role) || gapBetween(line, below) > limit) break;
    block.unshift(id);
    below = line;
  }
  return block;
}

/** Starts an unlabelled question at `line` ("A."), or null when the line does not open one. */
export function unlabelledStart(walk: Walk, line: Line, signals: Signals): LineRole | null {
  const { option } = signals;
  if (!option || option.index !== 0 || !opensSet(walk)) return null;
  if (!secondOptionSoon(walk, line.id, option.system)) return null;
  const number = (walk.last ?? 0) + 1;
  const [first, ...rest] = stemBlock(walk, line);
  openQuestion(walk, number, true);
  walk.system = option.system;
  if (first === undefined) {
    // No text above: the option line itself carries the inferred start (and stands for A).
    takeOption(walk, line, INFERRED);
    return roleOf(line, 'label', INFERRED, { number });
  }
  walk.roles[first] = { line: first, role: 'label', confidence: INFERRED, number };
  for (const id of rest) walk.roles[id] = { line: id, role: 'stem', confidence: 0.5 };
  return takeOption(walk, line, 0.6);
}
