// M34 P2, lesson D1.2 in code: what a pasted image is, from its OCR and its pixels. The code
// decides only what is clear; anything else is `unsure` and P4 asks a vision model.
import type { RgbImage } from './rgb-image.js';

export type ImageClass = 'text_picture' | 'handwriting' | 'figure' | 'table' | 'unsure';

/** What OCR found inside the image. */
export interface OcrStats {
  words: number;
  /** Mean word confidence, 0–100 (0 when there are no words). */
  confidence: number;
  /** Share of the image covered by OCR word boxes. */
  textAreaRatio: number;
}

/** Pixel statistics of a rendered image region. */
export interface ImageStats {
  /** Near-white, unsaturated pixels: the paper. */
  paperShare: number;
  /** Dark pixels (print, pen, film). */
  darkShare: number;
  /** Share of the non-paper pixels that are red or blue pen ink. */
  penShare: number;
  /** Bright saturated pixels: highlighter ink. */
  markerShare: number;
  /** Grey levels (of 16) that each hold at least 1% of the pixels: photographs spread wide. */
  toneLevels: number;
  /** Centres of full-width dark rules, as a share of the height (top = 0). */
  rows: number[];
  /** Centres of full-height dark rules, as a share of the width (left = 0). */
  columns: number[];
}

const PAPER_LUMA = 240;
const PAPER_SATURATION = 30;
const DARK_LUMA = 128;
const RED_PEN_LEAD = 70;
const BLUE_PEN_LEAD = 50;
const MARKER_SATURATION = 80;
const MARKER_LUMA = 170;
const TONE_MIN_SHARE = 0.01;
/** A rule is darker than this… */
const RULE_LUMA = 160;
/** …across at least this share of the image's width (or height)… */
const RULE_SPAN = 0.6;
/** …and thin: a dark band thicker than this share of the side is a dark picture, not a rule. */
const RULE_MAX_THICKNESS = 0.015;
const RULE_MIN_PIXELS = 3;

const luma = (r: number, g: number, b: number) => (299 * r + 587 * g + 114 * b) / 1000;

/** The red, green and blue of pixel `index` (row-major). */
export function pixelAt(image: RgbImage, index: number): [number, number, number] {
  const at = index * 3;
  return [image.data[at] ?? 0, image.data[at + 1] ?? 0, image.data[at + 2] ?? 0];
}

/** The grey level (0–255) of pixel `index`. */
export const pixelLuma = (image: RgbImage, index: number) => luma(...pixelAt(image, index));

const bump = (counts: number[], index: number) => {
  counts[index] = (counts[index] ?? 0) + 1;
};

function isPen(r: number, g: number, b: number): boolean {
  return r - Math.max(g, b) >= RED_PEN_LEAD || b - Math.max(r, g) >= BLUE_PEN_LEAD;
}

interface Tally {
  counted: number;
  paper: number;
  dark: number;
  pen: number;
  marker: number;
  tones: number[];
}

function tallyPixel(tally: Tally, r: number, g: number, b: number): void {
  const y = luma(r, g, b);
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  tally.counted++;
  bump(tally.tones, Math.min(15, Math.floor(y / 16)));
  if (y >= PAPER_LUMA && saturation < PAPER_SATURATION) {
    tally.paper++;
    return;
  }
  if (y < DARK_LUMA) tally.dark++;
  if (saturation >= MARKER_SATURATION && y >= MARKER_LUMA) tally.marker++;
  else if (isPen(r, g, b)) tally.pen++;
}

/** Centres of thin runs of `true`, as a share of the run length. */
function runCentres(flags: readonly boolean[]): number[] {
  const thickest = Math.max(RULE_MIN_PIXELS, flags.length * RULE_MAX_THICKNESS);
  const centres: number[] = [];
  let start = -1;
  flags.forEach((flag, index) => {
    if (flag && start < 0) start = index;
    if ((!flag || index === flags.length - 1) && start >= 0) {
      const end = flag ? index : index - 1;
      if (end - start + 1 <= thickest)
        centres.push((start + end) / 2 / Math.max(1, flags.length - 1));
      start = -1;
    }
  });
  return centres;
}

/** Full-width dark rows and full-height dark columns (table grid lines, frames). */
function rules(image: RgbImage): { rows: number[]; columns: number[] } {
  const { width, height } = image;
  const rowDark = new Array<number>(height).fill(0);
  const columnDark = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixelLuma(image, y * width + x) >= RULE_LUMA) continue;
      bump(rowDark, y);
      bump(columnDark, x);
    }
  }
  return {
    rows: runCentres(rowDark.map((count) => count >= width * RULE_SPAN)),
    columns: runCentres(columnDark.map((count) => count >= height * RULE_SPAN)),
  };
}

/**
 * Measures a rendered region. `skip` (one byte per pixel, non-zero = ignore) leaves out what is
 * drawn over a large image, such as the page's own text over a watermark.
 */
export function measureImage(image: RgbImage, skip?: Uint8Array): ImageStats {
  const tally: Tally = { counted: 0, paper: 0, dark: 0, pen: 0, marker: 0, tones: [] };
  tally.tones = new Array<number>(16).fill(0);
  for (let pixel = 0; pixel < image.width * image.height; pixel++) {
    if (skip?.[pixel]) continue;
    tallyPixel(tally, ...pixelAt(image, pixel));
  }
  const total = Math.max(1, tally.counted);
  const ink = Math.max(1, tally.counted - tally.paper);
  return {
    paperShare: tally.paper / total,
    darkShare: tally.dark / total,
    penShare: tally.pen / ink,
    markerShare: tally.marker / total,
    toneLevels: tally.tones.filter((count) => count >= total * TONE_MIN_SHARE).length,
    ...rules(image),
  };
}

/** Highlighter over a few words: a mark, read as handwriting. */
const MARKER_MIN_SHARE = 0.25;
const MARKER_MAX_WORDS = 8;
/** Red or blue pen on paper with few or poorly read words: handwriting. */
const PEN_MIN_PAPER = 0.5;
const PEN_MIN_SHARE = 0.3;
const PEN_MAX_WORDS = 6;
const PEN_MAX_CONFIDENCE = 70;
/** A grid on paper: three rules each way, or many rules across. */
const TABLE_MIN_PAPER = 0.5;
const TABLE_MIN_ROWS = 3;
const TABLE_MIN_COLUMNS = 2;
const TABLE_MIN_ROWS_ALONE = 5;
/** Printed words OCR reads well, covering part of the image. */
const TEXT_MIN_WORDS = 5;
const TEXT_MIN_CONFIDENCE = 60;
const TEXT_MIN_AREA = 0.08;
/**
 * Grey levels allowed outside the word boxes: paper and print (a coloured or dark background
 * is one more level); a photo, drawing or infographic spreads wider. Calibrated on the bench
 * corpus, where it best matched the truth's pictures of words (6 of 16).
 */
const TEXT_MAX_OUTSIDE_TONES = 6;
/** A picture: almost no readable text, and photographic tones or no paper background. */
const FIGURE_MAX_WORDS = 3;
const FIGURE_MAX_CONFIDENCE = 40;
const FIGURE_MIN_TONES = 5;
const FIGURE_MAX_PAPER = 0.4;

const isMarker = (ocr: OcrStats, stats: ImageStats) =>
  stats.markerShare >= MARKER_MIN_SHARE && ocr.words <= MARKER_MAX_WORDS;

const isPenWriting = (ocr: OcrStats, stats: ImageStats) =>
  stats.paperShare >= PEN_MIN_PAPER &&
  stats.penShare >= PEN_MIN_SHARE &&
  (ocr.words <= PEN_MAX_WORDS || ocr.confidence < PEN_MAX_CONFIDENCE);

const isTable = (stats: ImageStats) =>
  stats.paperShare >= TABLE_MIN_PAPER &&
  ((stats.rows.length >= TABLE_MIN_ROWS && stats.columns.length >= TABLE_MIN_COLUMNS) ||
    stats.rows.length >= TABLE_MIN_ROWS_ALONE);

const isPrintedText = (ocr: OcrStats) =>
  ocr.words >= TEXT_MIN_WORDS &&
  ocr.confidence >= TEXT_MIN_CONFIDENCE &&
  ocr.textAreaRatio >= TEXT_MIN_AREA;

const isPicture = (ocr: OcrStats, stats: ImageStats) =>
  (ocr.words <= FIGURE_MAX_WORDS || ocr.confidence < FIGURE_MAX_CONFIDENCE) &&
  (stats.toneLevels >= FIGURE_MIN_TONES || stats.paperShare < FIGURE_MAX_PAPER);

/**
 * Outside the words OCR read, a picture of printed words holds only its background: a
 * diagram, photo or infographic with a few labels holds many tones. Unknown (no `outside`
 * stats) counts as little.
 */
const littleOtherInk = (outside: ImageStats | undefined) =>
  !outside || outside.toneLevels <= TEXT_MAX_OUTSIDE_TONES;

/** The image's class by code, in this order of precedence; `unsure` goes to the vision lesson. */
export function classifyImage(ocr: OcrStats, stats: ImageStats, outside?: ImageStats): ImageClass {
  if (isMarker(ocr, stats) || isPenWriting(ocr, stats)) return 'handwriting';
  if (isTable(stats)) return 'table';
  if (isPrintedText(ocr) && littleOtherInk(outside)) return 'text_picture';
  if (isPicture(ocr, stats)) return 'figure';
  return 'unsure';
}
