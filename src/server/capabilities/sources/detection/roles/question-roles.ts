import {
  answerLetter,
  type OptionLabel,
  type OptionSystem,
  type QuestionLabel,
} from '../../domain/labels.js';
import type { Line, LineRole } from '../contract.js';
import { atMargin, sameParagraph, startOf } from './geometry.js';
import type { Signals } from './signals.js';
import { unlabelledStart } from './unlabelled.js';
import { excerpt, inQuestion, openQuestion, roleOf, takeOption, type Walk } from './walk.js';

// M39 step 3: question labels and options, read in context (numbering and letters follow on).

/** A bare number may skip a few questions the file lost, never jump far. */
const SKIP = 10;
/** An option read after a lost one: kept in order, its letters in doubt for the checks. */
const LOST = 0.45;

const alphabet = (system: OptionSystem) => (system === 'lower' ? 'latin' : system);
const sameAlphabet = (system: OptionSystem | null, other: OptionSystem) =>
  system === null || alphabet(system) === alphabet(other);

/** The body begins at its second word or inside a joined label/body OCR word. */
function bodyStart(line: Line, option: OptionLabel): number | null {
  const first = line.words[0];
  if (!first) return null;
  const prefix = line.text.length - option.text.length;
  const width = first.box.x1 - first.box.x0;
  if (prefix < first.text.length)
    return startOf(line) + ((line.rtl ? -1 : 1) * width * prefix) / first.text.length;
  const body = line.words[1];
  return body ? (line.rtl ? body.box.x1 : body.box.x0) : null;
}

/** The preceding labelled option supplies the measured body indent for a lost label. */
function optionBodyStart(walk: Walk): number | null {
  const role = walk.roles.findLast(
    (one) =>
      one.role === 'option' && one.letter === walk.letter && !!walk.signals[one.line]?.option,
  );
  if (!role) return null;
  const line = walk.file.lines[role.line];
  const option = walk.signals[role.line]?.option;
  return line && option ? bodyStart(line, option) : null;
}

const nearOptionStart = (walk: Walk, line: Line) => {
  const starts = [walk.optionStart, optionBodyStart(walk)].filter((at) => at !== null);
  return starts.some((at) => Math.abs(startOf(line) - at) <= walk.measure.margin);
};

/**
 * The line above the option that skips one letter, when it is the previous option's last line and
 * starts where that option does: OCR lost its letter (a circled one), so it is the lost option.
 */
function lostBetween(walk: Walk): Line | null {
  const above = walk.above;
  if (!above || walk.mode !== 'option' || walk.optionStart === null) return null;
  const role = walk.roles[above.id];
  const continues = role?.role === 'option' && role.letter === walk.letter;
  if (!continues || walk.signals[above.id]?.option) return null;
  return nearOptionStart(walk, above) ? above : null;
}

/**
 * Before any option, the stem line right above "B." that starts where it starts and does not
 * ask the question: OCR lost the first option's letter (a pen circle over it), so it is "A".
 */
function lostFirst(walk: Walk, above: Line, line: Line): Line | null {
  if (walk.roles[above.id]?.role !== 'stem' || /[?؟:]\s*$/.test(above.text)) return null;
  return Math.abs(startOf(above) - startOf(line)) <= walk.measure.margin ? above : null;
}

/** An option one letter on from the expected one: the lost option, then this one, in order. */
function afterLost(walk: Walk, line: Line, system: OptionSystem): LineRole {
  walk.system = system;
  const above = walk.above;
  const first = above && walk.mode === 'stem' && walk.options === 0;
  const lost = first ? lostFirst(walk, above, line) : lostBetween(walk);
  if (lost) walk.roles[lost.id] = takeOption(walk, lost, LOST);
  return takeOption(walk, line, LOST);
}

/** The next option by a letter with no label mark: a table row's cell, or "B Call…" in a list. */
function unmarkedOption(walk: Walk, line: Line, signals: Signals): LineRole | null {
  const next = answerLetter(walk.options);
  if (signals.rowLetter === next) {
    walk.system ??= 'latin';
    return takeOption(walk, line, 0.7);
  }
  const listed =
    walk.options > 0 &&
    sameAlphabet(walk.system, 'latin') &&
    sameParagraph(walk.measure, walk.above, line);
  return listed && signals.looseLetter === next ? takeOption(walk, line, 0.6) : null;
}

/** A repeated OCR letter within the same contiguous set is positional, never trusted. */
function repeatedOption(walk: Walk, line: Line, signals: Signals): LineRole | null {
  const option = signals.option;
  if (!option || !sameAlphabet(walk.system, option.system) || option.index >= walk.options)
    return null;
  if (walk.mode !== 'option' || walk.above?.unitId !== line.unitId) return null;
  return sameParagraph(walk.measure, walk.above, line) ? takeOption(walk, line, LOST) : null;
}

const optionContext = (walk: Walk, line: Line) => inQuestion(walk) && !excerpt(walk, line);

/** The next option in sequence, one after a lost one, or one printed with no label mark. */
function optionRole(walk: Walk, line: Line, signals: Signals): LineRole | null {
  if (!optionContext(walk, line)) return null;
  const { option } = signals;
  const ahead = option && sameAlphabet(walk.system, option.system) ? option.index : -1;
  if (option && ahead === walk.options) {
    walk.system = option.system;
    return takeOption(walk, line, walk.mode === 'after' ? 0.7 : 0.9);
  }
  if (option && ahead === walk.options + 1) return afterLost(walk, line, option.system);
  return repeatedOption(walk, line, signals) ?? unmarkedOption(walk, line, signals);
}

/** A new option set before another numbered item distinguishes a question from a list. */
function optionsFollow(walk: Walk, line: Line): boolean {
  for (let id = line.id + 1; id < walk.signals.length; id++) {
    const next = walk.signals[id];
    if (!next) continue;
    if (next.label || next.heading || next.keyHeading || next.answer) return false;
    if (next.option) return next.option.index === 0;
    if (next.rowLetter) return next.rowLetter === 'A';
  }
  return false;
}

/** Inside an explanation, a key or a stem a bare number needs a question's context. */
function bareInText(walk: Walk, line: Line, label: QuestionLabel): number | null | undefined {
  const next = label.number === (walk.last ?? 0) + 1;
  if (walk.mode === 'explanation' || walk.mode === 'key')
    return next && optionsFollow(walk, line) ? 0.85 : null;
  if (walk.mode === 'stem' && walk.hasStem && walk.options === 0) return next ? 0.55 : null;
  return undefined;
}

const independentPrompt = (walk: Walk, line: Line, label: QuestionLabel) =>
  line.source === 'picture' &&
  (!walk.above || walk.above.unitId !== line.unitId) &&
  /[?؟]$/.test(label.text.trim());

/** How sure a bare "12." is a question label here; null when it is not one. */
function bareConfidence(walk: Walk, line: Line, label: QuestionLabel): number | null {
  if (independentPrompt(walk, line, label)) return 0.6;
  const inText = bareInText(walk, line, label);
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

/** An excerpt's label (explanation), a repeated one (stem), a prefixed one; null otherwise. */
function labelRole(walk: Walk, line: Line, label: QuestionLabel): LineRole | null {
  if (excerpt(walk, line)) {
    walk.mode = 'explanation';
    return roleOf(line, 'explanation', 0.6);
  }
  // The number of the question being read, printed again before its options: more of its stem.
  if (label.number === walk.last && walk.mode === 'stem' && walk.options === 0) {
    walk.hasStem = true;
    return roleOf(line, 'stem', 0.7);
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
  const unlabelled = unlabelledStart(walk, line, signals);
  if (unlabelled) return unlabelled;
  const option = optionRole(walk, line, signals);
  if (option) return option;
  const bare = label ? bareConfidence(walk, line, label) : null;
  if (label && bare !== null) return startLabel(walk, line, label, bare);
  return null;
}
