import { boxHeight, type Box } from './page.js';

/** A grayscale page image; `scale` is pixels per PDF point. */
export interface Raster {
  width: number;
  height: number;
  scale: number;
  pixels: Uint8Array;
}

export interface MarkScore {
  letter: string;
  ink: number;
}

/** Darker than this (0 = black, 255 = white) counts as ink; light highlighter does not. */
const INK_LEVEL = 150;
/**
 * Above the ink every option shares (page borders, rules), the best option needs this much
 * more ink around its letter… (calibrated on the cardiology sample only; the other files validate it)
 */
const MIN_INK = 0.012;
/** …and this many times more than the runner-up, or nothing is decided. */
const MIN_LEAD = 2;

const inside = (box: Box, x: number, y: number) =>
  x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;

const grow = (box: Box, by: number): Box => ({
  x0: box.x0 - by,
  y0: box.y0 - by,
  x1: box.x1 + by,
  y1: box.y1 + by,
});

/** The ring a hand-drawn circle around the letter passes through (left, above, below). */
function markRegion(letter: Box): Box {
  const h = boxHeight(letter);
  return {
    x0: letter.x0 - h * 0.9,
    y0: letter.y0 - h * 0.5,
    x1: letter.x1 + h * 0.2,
    y1: letter.y1 + h * 0.5,
  };
}

/**
 * Share of ink pixels around an option letter, ignoring printed words (the letter itself and any
 * neighbouring text). Works the same for text PDFs and scans: only the rendered page is used.
 */
export function inkAround(raster: Raster, letter: Box, printed: readonly Box[]): number {
  const region = markRegion(letter);
  const masks = printed.map((box) => grow(box, 0.6));
  const s = raster.scale;
  let ink = 0;
  let total = 0;
  for (
    let py = Math.max(0, Math.floor(region.y0 * s));
    py < Math.min(raster.height, region.y1 * s);
    py++
  ) {
    for (
      let px = Math.max(0, Math.floor(region.x0 * s));
      px < Math.min(raster.width, region.x1 * s);
      px++
    ) {
      if (masks.some((mask) => inside(mask, px / s, py / s))) continue;
      total += 1;
      if ((raster.pixels[py * raster.width + px] ?? 255) < INK_LEVEL) ink += 1;
    }
  }
  return total === 0 ? 0 : ink / total;
}

/**
 * The marked option, only when one stands out clearly. Otherwise null: an unclear mark becomes a
 * review item, never a guessed answer key (honest provenance, FR-06).
 */
export function pickMarked(scores: readonly MarkScore[]): MarkScore | null {
  const baseline = Math.min(...scores.map((score) => score.ink));
  const ranked = scores
    .map((score) => ({ ...score, ink: score.ink - baseline }))
    .sort((a, b) => b.ink - a.ink);
  const [best, second] = ranked;
  if (!best || best.ink < MIN_INK) return null;
  if (second && best.ink < second.ink * MIN_LEAD) return null;
  return scores.find((score) => score.letter === best.letter) ?? null;
}
