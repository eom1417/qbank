import type { KeyEntry } from '../../domain/key-lines.js';
import type { Line, LineRole } from '../contract.js';
import type { Signals } from './signals.js';
import { inQuestion, roleOf, type Walk } from './walk.js';

// M39 step 3: lines whose own words name their role: filler, notes, tags, headings, answers, keys.

/** Filler, the reader's notes, exam tags and section headings (a heading ends the question). */
export function pageRole(walk: Walk, line: Line, signals: Signals): LineRole | null {
  if (signals.filler) return roleOf(line, 'filler', 0.9);
  if (signals.note) return roleOf(line, 'note', 0.95);
  if (signals.tag) return roleOf(line, 'tag', 0.9);
  if (!signals.heading) return null;
  walk.mode = 'none';
  return roleOf(line, 'heading', 0.85);
}

function entriesRole(walk: Walk, line: Line, entries: KeyEntry[]): LineRole {
  const confidence = walk.mode === 'key' ? 0.95 : entries.length > 1 ? 0.8 : 0.6;
  const number = entries.length === 1 ? entries[0]?.number : undefined;
  return roleOf(line, 'key_table', confidence, { entries, ...(number ? { number } : {}) });
}

/** A printed answer: the text after it is its explanation until the next question starts. */
function answerRole(walk: Walk, line: Line, signals: Signals): LineRole {
  const confidence = signals.doubtful ? 0.3 : inQuestion(walk) ? 0.9 : 0.5;
  walk.mode = 'explanation';
  return roleOf(line, 'answer', confidence, {
    letters: signals.doubtful ? [] : (signals.answer ?? []),
  });
}

/** Answers, answer-key headings and entries, and a marked explanation's first line. */
export function keyRole(walk: Walk, line: Line, signals: Signals): LineRole | null {
  if (signals.keyHeading) {
    walk.mode = 'key';
    return roleOf(line, 'key_table', 0.9);
  }
  if (signals.doubtful || signals.answer) return answerRole(walk, line, signals);
  if (signals.entries) return entriesRole(walk, line, signals.entries);
  if (!signals.explanation) return null;
  walk.mode = 'explanation';
  return roleOf(line, 'explanation', 0.9);
}
