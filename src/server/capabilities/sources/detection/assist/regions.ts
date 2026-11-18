// M39 step 6: the region the AI is shown for one doubt: its lines plus the context up to the
// label line before and after them, never more than REGION_CAP lines.
import type { Doubt, LineRole } from '../contract.js';

/** The most lines one region shows the model. */
export const REGION_CAP = 60;

/** The nearest label line from `from` walking by `step`, or the last line inside the file. */
function labelEdge(labels: ReadonlySet<number>, from: number, step: 1 | -1, last: number): number {
  let at = from;
  while (at + step >= 0 && at + step <= last && !labels.has(at)) at += step;
  return at;
}

/** The line ids of the doubt's region, ascending; empty when the doubt has no lines. */
export function regionOf(doubt: Doubt, roles: readonly LineRole[], lineCount: number): number[] {
  if (doubt.lines.length === 0 || lineCount === 0) return [];
  const labels = new Set(roles.filter((role) => role.role === 'label').map((role) => role.line));
  const last = lineCount - 1;
  const first = Math.max(0, Math.min(...doubt.lines));
  const end = Math.min(last, Math.max(...doubt.lines));
  const start = first > 0 ? labelEdge(labels, first - 1, -1, last) : 0;
  const stop = end < last ? labelEdge(labels, end + 1, 1, last) : last;
  const size = Math.min(REGION_CAP, stop - start + 1);
  return Array.from({ length: size }, (_, i) => start + i);
}
