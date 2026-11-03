import type { Raster } from './answer-marks.js';
import { area, figureSized, intersect, wordsInside, type MediaRegion } from './media-regions.js';
import { overlaps, type Box, type PageText } from './page.js';

/** Darker than this is ink for table rules; the pink grid of an ECG and light shading are not. */
const INK = 170;
/** On a scan, anything not paper-white may be part of a picture (a pale photo, a film). */
export const PICTURE_LEVEL = 230;
/** OCR sometimes reads a whole picture as one huge "word"; such boxes do not hide ink. */
const MAX_WORD_HEIGHTS = 2.5;
/** A table rule is at least this long and at most this thick (points). */
const MIN_RULE = 100;
const MAX_RULE_THICKNESS = 3;
/** Rules of one table sit closer than this, and a table has at least this many. */
const MAX_ROW_GAP = 80;
const MIN_RULES = 3;
const MIN_TABLE_WORDS = 4;

/** The page's words without OCR's huge misreads of pictures. */
function ordinaryWords(page: PageText) {
  const heights = page.words.map((word) => word.box.y1 - word.box.y0).sort((a, b) => a - b);
  const tallest = (heights[Math.floor(heights.length / 2)] ?? 0) * MAX_WORD_HEIGHTS;
  return page.words.filter((word) => word.box.y1 - word.box.y0 <= tallest);
}

/** Ink pixels that are not printed words: rules, drawings, photos (1 = ink). */
export function inkWithoutWords(raster: Raster, page: PageText, level = INK): Uint8Array {
  const ink = new Uint8Array(raster.width * raster.height);
  raster.pixels.forEach((value, index) => {
    ink[index] = value < level ? 1 : 0;
  });
  for (const word of ordinaryWords(page)) {
    const x0 = Math.max(0, Math.floor((word.box.x0 - 1) * raster.scale));
    const x1 = Math.min(raster.width - 1, Math.ceil((word.box.x1 + 1) * raster.scale));
    const y0 = Math.max(0, Math.floor((word.box.y0 - 1) * raster.scale));
    const y1 = Math.min(raster.height - 1, Math.ceil((word.box.y1 + 1) * raster.scale));
    for (let y = y0; y <= y1; y++) ink.fill(0, y * raster.width + x0, y * raster.width + x1 + 1);
  }
  return ink;
}

/** Long horizontal runs of ink, merged across neighbouring pixel rows (in points). */
export function horizontalRules(ink: Uint8Array, raster: Raster): Box[] {
  const rules: Box[] = [];
  const minRun = MIN_RULE * raster.scale;
  for (let y = 0; y < raster.height; y++) {
    let start = -1;
    for (let x = 0; x <= raster.width; x++) {
      const on = x < raster.width && ink[y * raster.width + x] === 1;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= minRun) addRun(rules, start, x, y, raster.scale);
        start = -1;
      }
    }
  }
  return rules.filter((rule) => rule.y1 - rule.y0 <= MAX_RULE_THICKNESS);
}

/** Adds one pixel run, joining the rule right above it when they line up. */
function addRun(rules: Box[], x0: number, x1: number, y: number, scale: number) {
  const box = { x0: x0 / scale, x1: x1 / scale, y0: y / scale, y1: (y + 1) / scale };
  const above = rules.find(
    (rule) => Math.abs(rule.y1 - box.y0) < 0.5 / scale + 0.01 && Math.abs(rule.x0 - box.x0) < 4,
  );
  if (above) {
    above.y1 = box.y1;
    above.x1 = Math.max(above.x1, box.x1);
  } else rules.push(box);
}

/** The rules below `first` with its width, each close under the previous one. */
function stackUnder(first: Box, sorted: readonly Box[]): Box[] {
  const group = [first];
  for (const rule of sorted) {
    const last = group[group.length - 1] as Box;
    const aligned = Math.abs(rule.x0 - first.x0) < 10 && Math.abs(rule.x1 - first.x1) < 10;
    if (aligned && rule.y0 > last.y1 && rule.y0 - last.y1 <= MAX_ROW_GAP) group.push(rule);
  }
  return group;
}

/** Rules of the same width stacked close together, with words between: a table (M5.5). */
export function ruledTables(page: PageText, rules: readonly Box[]): MediaRegion[] {
  const sorted = [...rules].sort((a, b) => a.y0 - b.y0);
  const tables: MediaRegion[] = [];
  const used = new Set<Box>();
  for (const first of sorted) {
    if (used.has(first)) continue;
    const group = stackUnder(first, sorted);
    const box = { x0: first.x0, x1: first.x1, y0: first.y0, y1: (group.at(-1) as Box).y1 };
    const enough = group.length >= MIN_RULES && wordsInside(page, box) >= MIN_TABLE_WORDS;
    if (!enough || !figureSized(page, box)) continue;
    group.forEach((rule) => used.add(rule));
    tables.push({ page: page.page, box, kind: 'table', ppi: null });
  }
  return tables;
}

/** Scan figures are found on a grid of cells this size (points). */
const CELL = 4;
/** A picture fills at least this share of its box with ink; scattered strokes do not. */
const MIN_FILL = 0.2;
/** Words covering more than this share of a box make it text (a highlighted paragraph). */
const MAX_TEXT_SHARE = 0.12;

const textShare = (page: PageText, box: Box) =>
  ordinaryWords(page)
    .filter((word) => overlaps(word.box, box))
    .reduce((sum, word) => sum + area(intersect(word.box, box)), 0) / Math.max(1, area(box));

function inkCells(ink: Uint8Array, raster: Raster) {
  const size = CELL * raster.scale;
  const columns = Math.ceil(raster.width / size);
  const rows = Math.ceil(raster.height / size);
  const cells = new Uint8Array(columns * rows);
  for (let y = 0; y < raster.height; y++)
    for (let x = 0; x < raster.width; x++)
      if (ink[y * raster.width + x])
        cells[Math.floor(y / size) * columns + Math.floor(x / size)] = 1;
  return { cells, columns, rows };
}

type Grid = ReturnType<typeof inkCells>;

/** Ink cells within two cells of `cell` (one empty cell may separate parts of a picture). */
function neighbours(cell: number, { cells, columns, rows }: Grid): number[] {
  const cx = cell % columns;
  const cy = Math.floor(cell / columns);
  const found: number[] = [];
  for (let ny = Math.max(0, cy - 2); ny <= Math.min(rows - 1, cy + 2); ny++)
    for (let nx = Math.max(0, cx - 2); nx <= Math.min(columns - 1, cx + 2); nx++)
      if (cells[ny * columns + nx]) found.push(ny * columns + nx);
  return found;
}

/** Every ink cell reachable from `start`, as a box in points with its share of ink. */
function floodFrom(start: number, grid: Grid, seen: Uint8Array) {
  const { columns } = grid;
  const stack = [start];
  seen[start] = 1;
  const span = { x0: Infinity, y0: Infinity, x1: -1, y1: -1, count: 0 };
  while (stack.length > 0) {
    const cell = stack.pop() as number;
    const cx = cell % columns;
    const cy = Math.floor(cell / columns);
    span.x0 = Math.min(span.x0, cx);
    span.y0 = Math.min(span.y0, cy);
    span.x1 = Math.max(span.x1, cx);
    span.y1 = Math.max(span.y1, cy);
    span.count += 1;
    for (const next of neighbours(cell, grid)) {
      if (seen[next]) continue;
      seen[next] = 1;
      stack.push(next);
    }
  }
  const box = {
    x0: span.x0 * CELL,
    y0: span.y0 * CELL,
    x1: (span.x1 + 1) * CELL,
    y1: (span.y1 + 1) * CELL,
  };
  return { box, fill: span.count / ((span.x1 - span.x0 + 1) * (span.y1 - span.y0 + 1)) };
}

/** Groups of touching ink cells: each a candidate picture. */
function inkGroups(grid: Grid) {
  const seen = new Uint8Array(grid.cells.length);
  const groups: { box: Box; fill: number }[] = [];
  for (let start = 0; start < grid.cells.length; start++)
    if (grid.cells[start] && !seen[start]) groups.push(floodFrom(start, grid, seen));
  return groups;
}

/** Pictures on a scanned page: dense ink that is not words and not a table (FR-06-001). */
export function scanFigures(
  ink: Uint8Array,
  raster: Raster,
  page: PageText,
  tables: readonly MediaRegion[],
): MediaRegion[] {
  return inkGroups(inkCells(ink, raster))
    .filter((group) => group.fill >= MIN_FILL && figureSized(page, group.box))
    .filter((group) => textShare(page, group.box) <= MAX_TEXT_SHARE)
    .filter((group) => !tables.some((table) => overlaps(table.box, group.box)))
    .map((group) => ({ page: page.page, box: group.box, kind: 'figure' as const, ppi: null }));
}
