import type { Line, LineRole } from '../contract.js';
import { gapBetween, sameParagraph } from './geometry.js';
import type { Signals } from './signals.js';
import { inQuestion, roleOf, type Walk } from './walk.js';

// M39 step 3: plain text takes its role from where the reading is (stem, option, explanation).

/** A title line before any question is short; longer text there is unplaced. */
const TITLE_WORDS = 6;

/**
 * A picture after a printed stem that has asked its question: the figure it shows. Its words
 * are the picture's own (filler to the text; the picture, left unread, is shown as it is).
 */
const figureAfterQuestion = (walk: Walk, line: Line) =>
  line.source === 'picture' &&
  walk.above?.source !== 'picture' &&
  /[?؟]\s*$/.test(walk.above?.text ?? '');

function stemRole(walk: Walk, line: Line): LineRole {
  if (figureAfterQuestion(walk, line)) return roleOf(line, 'filler', 0.5);
  const far = walk.hasStem && gapBetween(walk.above, line) > walk.measure.far;
  walk.hasStem = true;
  if (!far) return roleOf(line, 'stem', 0.85);
  // Far below a stem that has text: a picture's words still belong, anything else is in doubt.
  return roleOf(line, 'stem', line.source === 'picture' ? 0.6 : 0.45);
}

/** Text across a picture's edge (into or out of one) is never more of the same element. */
const acrossPicture = (above: Line | undefined, line: Line) =>
  !!above &&
  above.unitId !== line.unitId &&
  (above.source === 'picture' || line.source === 'picture');

/** A line already read in this question: a table header the page repeats above each row. */
function repeatsInQuestion(walk: Walk, line: Line): boolean {
  const text = line.text.trim();
  for (let id = line.id - 1; id >= 0; id--) {
    if (walk.file.lines[id]?.text.trim() === text) return true;
    if (walk.roles[id]?.role === 'label') return false;
  }
  return false;
}

/** An option's wrapped line, or text a block below the options (an unmarked explanation?). */
function optionText(walk: Walk, line: Line): LineRole {
  if (repeatsInQuestion(walk, line)) return roleOf(line, 'filler', 0.7);
  if (sameParagraph(walk.measure, walk.above, line) && !acrossPicture(walk.above, line))
    return roleOf(line, 'option', 0.8, walk.letter ? { letter: walk.letter } : {});
  walk.mode = 'after';
  return roleOf(line, 'explanation', 0.45);
}

function beforeQuestions(line: Line): LineRole {
  const short = line.text.trim().split(/\s+/).length <= TITLE_WORDS;
  return short ? roleOf(line, 'heading', 0.5) : roleOf(line, 'unknown', 0.3);
}

export function textRole(walk: Walk, line: Line, signals: Signals): LineRole {
  // An option letter out of turn: a lost option, or a stem line; either way a doubt.
  if (signals.option && inQuestion(walk)) return roleOf(line, 'unknown', 0.3);
  switch (walk.mode) {
    case 'none':
      return beforeQuestions(line);
    case 'stem':
      return stemRole(walk, line);
    case 'option':
      return optionText(walk, line);
    case 'after':
      return roleOf(line, 'explanation', 0.45);
    case 'explanation':
      return roleOf(line, 'explanation', 0.85);
    case 'key':
      return roleOf(line, 'explanation', 0.5);
  }
}
