import type { Line, LineRole } from '../contract.js';
import type { Signals } from './signals.js';
import { excerpt, openQuestion, roleOf, type Walk } from './walk.js';

/** A picture's opening text asks a question before its options or its answer begins. */
function asksQuestion(walk: Walk, start: Line): boolean {
  for (let id = start.id; id < walk.file.lines.length; id++) {
    const line = walk.file.lines[id];
    const signals = walk.signals[id];
    if (!line || line.unitId !== start.unitId || !signals) return false;
    if (signals.option || signals.answer || signals.keyHeading || signals.entries) return false;
    if (/[?؟]$/.test(line.text.trim())) return true;
  }
  return false;
}

/** Standalone prompts without a usable number stay inferred, including essay questions. */
export function promptRole(walk: Walk, line: Line, signals: Signals): LineRole | null {
  if (line.source !== 'picture' || signals.option || excerpt(walk, line)) return null;
  const previous = walk.file.lines[line.id - 1];
  if (previous?.unitId === line.unitId || !asksQuestion(walk, line)) return null;
  openQuestion(walk, (walk.last ?? 0) + 1, true);
  walk.fromPicture = true;
  return roleOf(line, 'label', 0.4);
}
