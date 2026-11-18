import type { Layout, Line } from '../contract.js';

// M39 step 2: the file's own spacing, measured from its printed lines (plan §2.4): no step
// uses a fixed distance.

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** The page's own reading lines: text layer or OCR, never a picture's or a device note. */
const printed = (line: Line) => line.source !== 'picture' && !line.deviceNote;

/** Gaps between a line and the next one below it on the same page, in reading order. */
function gapsOf(lines: readonly Line[]): number[] {
  const gaps: number[] = [];
  lines.forEach((line, index) => {
    const next = lines[index + 1];
    if (!next || next.page !== line.page) return;
    const gap = next.box.y0 - line.box.y1;
    if (gap >= 0) gaps.push(gap);
  });
  return gaps;
}

/**
 * In-paragraph and paragraph gaps: the sorted gaps split at their widest jump, when that jump is
 * more than half a measured line; otherwise every gap is in-paragraph.
 */
function splitGaps(gaps: readonly number[], lineHeight: number) {
  const sorted = [...gaps].sort((a, b) => a - b);
  let cut = sorted.length;
  let widest = lineHeight / 2;
  for (let index = 0; index + 1 < sorted.length; index++) {
    const jump = (sorted[index + 1] ?? 0) - (sorted[index] ?? 0);
    if (jump > widest) [widest, cut] = [jump, index + 1];
  }
  const lineGap = median(sorted.slice(0, cut));
  const wide = sorted.slice(cut);
  return { lineGap, paragraphGap: wide.length > 0 ? median(wide) : lineGap + lineHeight };
}

/** The most common start edge of each page's lines (a right-to-left line starts at its right). */
function marginsOf(lines: readonly Line[]): Map<number, number> {
  const counts = new Map<number, Map<number, number>>();
  for (const line of lines) {
    const edge = Math.round(line.rtl ? line.box.x1 : line.box.x0);
    const page = counts.get(line.page) ?? new Map<number, number>();
    page.set(edge, (page.get(edge) ?? 0) + 1);
    counts.set(line.page, page);
  }
  const margins = new Map<number, number>();
  for (const [page, edges] of counts) {
    const [edge] = [...edges].reduce((best, entry) => (entry[1] > best[1] ? entry : best));
    margins.set(page, edge);
  }
  return margins;
}

/** The file's layout from its lines in reading order (all lines when none is printed). */
export function measureLayout(lines: readonly Line[]): Layout {
  const own = lines.some(printed) ? lines.filter(printed) : lines;
  const lineHeight = median(own.map((line) => line.box.y1 - line.box.y0));
  return { lineHeight, ...splitGaps(gapsOf(own), lineHeight), margins: marginsOf(own) };
}
