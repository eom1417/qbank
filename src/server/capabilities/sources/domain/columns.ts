import { isRtlText } from './bidi.js';
import type { PageText, PageWord } from './page.js';

/** Where a gutter between two columns may lie, as a share of the page width. */
const GUTTER_ZONE = [0.3, 0.7] as const;
const GUTTER_WIDTH = 12;
/** Each column must hold at least this share of the words… */
const MIN_COLUMN_SHARE = 0.2;
/** …and at most this share may cross the gutter (a full-width title). */
const MAX_CROSSING_SHARE = 0.05;
/** Rows are compared at roughly one text line (points). */
const ROW_HEIGHT = 14;
const MIN_ROWS = 6;
/** Share of a column's rows the other column must also fill. */
const MIN_SHARED_ROWS = 0.5;
/** Full-width lines (a centred title or running header) allowed across the gutter. */
const MAX_TITLE_ROWS = 1;

const crosses = (word: PageWord, x: number) =>
  word.box.x0 < x + GUTTER_WIDTH / 2 && word.box.x1 > x - GUTTER_WIDTH / 2;

interface Stretch {
  from: number;
  to: number;
}

/** Stretches of the middle zone where as few words cross as anywhere (a title may cross). */
function quietStretches(width: number, words: readonly PageWord[]) {
  const samples: { x: number; crossing: number }[] = [];
  for (let x = width * GUTTER_ZONE[0]; x <= width * GUTTER_ZONE[1]; x += 2) {
    samples.push({ x, crossing: words.filter((word) => crosses(word, x)).length });
  }
  const fewest = Math.min(...samples.map((sample) => sample.crossing));
  const stretches: Stretch[] = [];
  for (const sample of samples) {
    const last = stretches[stretches.length - 1];
    if (sample.crossing > fewest) continue;
    if (last && sample.x - last.to <= 2.5) last.to = sample.x;
    else stretches.push({ from: sample.x, to: sample.x });
  }
  return { stretches, fewest };
}

/** A real gutter has a column edge beside it: lines start (or, in Arabic, end) at one x. */
const alignment = (stretch: Stretch, words: readonly PageWord[]) =>
  words.filter((word) => word.box.x0 >= stretch.to - 2 && word.box.x0 <= stretch.to + GUTTER_WIDTH)
    .length +
  words.filter(
    (word) => word.box.x1 <= stretch.from + 2 && word.box.x1 >= stretch.from - GUTTER_WIDTH,
  ).length;

/** The gutter's x (the middle of the best-aligned quiet stretch) and how many words cross it. */
function emptiestGutter(width: number, words: readonly PageWord[]) {
  const { stretches, fewest } = quietStretches(width, words);
  const ranked = [...stretches].sort((a, b) => alignment(b, words) - alignment(a, words));
  const best = ranked[0];
  return { x: best ? (best.from + best.to) / 2 : 0, crossing: fewest };
}

/** Rows (by line height) that hold words on each side of the gutter. */
const rowsOf = (words: readonly PageWord[]) =>
  new Set(words.map((word) => Math.round((word.box.y0 + word.box.y1) / 2 / ROW_HEIGHT)));

/**
 * Two real columns run side by side: most rows hold words on both sides. A single column with
 * a gap on a few lines (a short line, a table cell) does not.
 */
function mostRowsSplit(left: readonly PageWord[], right: readonly PageWord[]): boolean {
  const leftRows = rowsOf(left);
  const rightRows = rowsOf(right);
  const shared = [...leftRows].filter(
    (row) => rightRows.has(row) || rightRows.has(row + 1) || rightRows.has(row - 1),
  );
  const rows = new Set([...leftRows, ...rightRows]).size;
  return rows >= MIN_ROWS && shared.length >= (rows * MIN_SHARED_ROWS) / 2;
}

/**
 * Splits a two-column page into its columns in reading order: left then right, or right then
 * left for Arabic (FR-05-004, JY-04). A single-column page comes back as one group.
 */
export function splitColumns(page: PageText, words: readonly PageWord[]): PageWord[][] {
  if (words.length < 8 || page.width <= 0) return [[...words]];
  const gutter = emptiestGutter(page.width, words);
  if (gutter.crossing > words.length * MAX_CROSSING_SHARE) return [[...words]];
  const spanning = words.filter((word) => crosses(word, gutter.x));
  const left = words.filter((word) => !crosses(word, gutter.x) && word.box.x1 <= gutter.x);
  const right = words.filter((word) => !crosses(word, gutter.x) && word.box.x0 >= gutter.x);
  const minimum = words.length * MIN_COLUMN_SHARE;
  if (left.length < minimum || right.length < minimum) return [[...words]];
  if (!mostRowsSplit(left, right)) return [[...words]];
  // Words across the gutter with words on both sides in their row make one line: a centred
  // title may do that once; more such lines mean a single column of text.
  const [leftRows, rightRows] = [rowsOf(left), rowsOf(right)];
  const lineRows = [...rowsOf(spanning)].filter((row) => leftRows.has(row) && rightRows.has(row));
  if (lineRows.length > MAX_TITLE_ROWS) return [[...words]];
  const rtl = isRtlText(words.map((word) => word.text).join(' '));
  return [spanning, ...(rtl ? [right, left] : [left, right])].filter((group) => group.length > 0);
}
