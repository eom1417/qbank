import type { OptionSystem } from '../../domain/labels.js';
import type { Line, LineRole } from '../contract.js';
import { gapBetween } from './geometry.js';
import type { Signals } from './signals.js';
import { excerpt, openQuestion, takeOption, type Walk } from './walk.js';

// M39 step 3: a question the file printed with no label. An "A." that opens a new set of options
// (inside an explanation, after a full set, before any question) with "B." soon after starts one;
// its label carries no printed number (linking infers the one after the last) and stays in doubt.

/** How many lines ahead the second option of a new set is looked for. */
const LOOKAHEAD = 8;
const INFERRED = 0.4;

/** Where a first option cannot continue the current question. */
function opensSet(walk: Walk, line: Line): boolean {
  if (['none', 'explanation', 'after', 'key'].includes(walk.mode)) return true;
  if (walk.mode === 'option') return walk.options >= 2;
  const label = walk.roles.findLast((role) => role.role === 'label');
  const before = label ? walk.file.lines[label.line] : undefined;
  return line.source === 'picture' && !!before && before.unitId !== line.unitId;
}

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

const crossesUnit = (start: Line, line: Line) =>
  start.source === 'picture' && line.unitId !== start.unitId;

/** The text block right above the first option, on its page: the unlabelled question's stem. */
function stemBlock(walk: Walk, start: Line): number[] {
  const block: number[] = [];
  let below = start;
  for (let id = start.id - 1; id >= 0; id--) {
    const role = walk.roles[id];
    const line = walk.file.lines[id];
    if (!role || !line) break;
    if (role.role === 'filler' || role.role === 'note') continue;
    if (crossesUnit(start, line)) break;
    const limit = block.length === 0 ? walk.measure.block : walk.measure.paragraph;
    if (!isFreeText(role) || gapBetween(line, below) > limit) break;
    block.unshift(id);
    below = line;
  }
  return block;
}

/** An alphabetic list needs a prompt, otherwise it may just be textbook subsections. */
function hasPrompt(walk: Walk, ids: readonly number[]): boolean {
  const text = ids.map((id) => walk.file.lines[id]?.text ?? '').join(' ');
  return /[?؟]|\b(?:which|what|how|why|when|where|following)\b/i.test(text);
}

/**
 * A stem that asks something and is the file's own: one read in a pasted picture is another
 * book's question (an excerpt), wherever its options were read.
 */
const ownStem = (walk: Walk, ids: [number, ...number[]]) =>
  hasPrompt(walk, ids) && !excerpt(walk, walk.file.lines[ids[0]] as Line);

/** Starts an unlabelled question at `line` ("A."), or null when the line does not open one. */
export function unlabelledStart(walk: Walk, line: Line, signals: Signals): LineRole | null {
  const { option } = signals;
  if (!option || option.index !== 0 || !opensSet(walk, line) || excerpt(walk, line)) return null;
  if (!secondOptionSoon(walk, line.id, option.system)) return null;
  const number = (walk.last ?? 0) + 1;
  const [first, ...rest] = stemBlock(walk, line);
  if (first === undefined || !ownStem(walk, [first, ...rest])) return null;
  openQuestion(walk, number, true);
  walk.system = option.system;
  walk.roles[first] = { line: first, role: 'label', confidence: INFERRED };
  for (const id of rest) walk.roles[id] = { line: id, role: 'stem', confidence: 0.5 };
  return takeOption(walk, line, 0.6);
}
