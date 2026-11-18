import { answerLetter, type QuestionLabel } from '../../domain/labels.js';
import type { Line, LineRole } from '../contract.js';
import { atMargin } from './geometry.js';
import type { Signals } from './signals.js';
import { unlabelledStart } from './unlabelled.js';
import { inQuestion, openQuestion, roleOf, takeOption, type Walk } from './walk.js';

// M39 step 3: question labels and options, read in context (numbering and letters follow on).

/** A bare number may skip a few questions the file lost, never jump far. */
const SKIP = 10;

/** The next option in sequence: its own label, or a table row whose first cell is the letter. */
function optionRole(walk: Walk, line: Line, signals: Signals): LineRole | null {
  if (!inQuestion(walk)) return null;
  const { option } = signals;
  const sameSystem = walk.system === null || walk.system === option?.system;
  if (option && option.index === walk.options && sameSystem) {
    walk.system = option.system;
    return takeOption(walk, line, walk.mode === 'after' ? 0.7 : 0.9);
  }
  if (signals.rowLetter !== answerLetter(walk.options)) return null;
  walk.system ??= 'latin';
  return takeOption(walk, line, 0.7);
}

/** Inside an explanation, a key or a stem a bare number is a list unless it is the next one. */
function bareInText(walk: Walk, label: QuestionLabel): number | null | undefined {
  const next = label.number === (walk.last ?? 0) + 1;
  if (walk.mode === 'explanation' || walk.mode === 'key') return next ? 0.85 : null;
  if (walk.mode === 'stem' && walk.hasStem && walk.options === 0) return next ? 0.55 : null;
  return undefined;
}

/** How sure a bare "12." is a question label here; null when it is not one. */
function bareConfidence(walk: Walk, line: Line, label: QuestionLabel): number | null {
  const inText = bareInText(walk, label);
  if (inText !== undefined) return inText;
  if (walk.last === null) return 0.7;
  const expected = walk.last + 1;
  if (label.number === expected) return 0.9;
  if (label.number === 1) return 0.6;
  const skip = label.number > expected && label.number <= expected + SKIP;
  return skip && atMargin(walk.file, walk.measure, line) ? 0.5 : null;
}

function startLabel(walk: Walk, line: Line, label: QuestionLabel, confidence: number): LineRole {
  openQuestion(walk, label.number, label.text.trim() !== '');
  walk.fromPicture = line.source === 'picture';
  if (!walk.fromPicture) walk.textPage = line.page;
  return roleOf(line, 'label', confidence, { number: label.number });
}

/**
 * A question printed in a picture on the page of a typed question, or the page after it, is an
 * excerpt of another book pasted as its explanation, not a question of the file (M34 D6.1).
 */
const excerpt = (walk: Walk, line: Line) =>
  line.source === 'picture' && walk.textPage !== null && line.page <= walk.textPage + 1;

/** An excerpt's label (explanation), or a prefixed label ("Question: 2"); null otherwise. */
function labelRole(walk: Walk, line: Line, label: QuestionLabel): LineRole | null {
  if (excerpt(walk, line)) {
    walk.mode = 'explanation';
    return roleOf(line, 'explanation', 0.6);
  }
  if (!label.prefixed) return null;
  const expected = walk.last === null || label.number === walk.last + 1;
  return startLabel(walk, line, label, expected ? 0.95 : 0.8);
}

/** A label, an option, or a question the file printed with no label; null for text. */
export function questionRole(walk: Walk, line: Line, signals: Signals): LineRole | null {
  const { label } = signals;
  const labelled = label ? labelRole(walk, line, label) : null;
  if (labelled) return labelled;
  const option = optionRole(walk, line, signals);
  if (option) return option;
  const bare = label ? bareConfidence(walk, line, label) : null;
  if (label && bare !== null) return startLabel(walk, line, label, bare);
  return unlabelledStart(walk, line, signals);
}
