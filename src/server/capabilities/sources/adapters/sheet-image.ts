// M34 P3: the contact sheet's pixels: a white canvas, a thin frame per cell, the cell's number
// in large black digits from a built-in 5×7 bitmap font, and each crop scaled into its box.
import type { RgbImage } from '../domain/pipeline/rgb-image.js';
import { layoutSheet, SHEET_LONG_EDGE, type Box } from '../domain/pipeline/sheet-layout.js';
import { encodePng } from './png-encode.js';

/** 5×7 digits, one string per row, `#` = ink. */
const DIGITS: Readonly<Record<string, readonly string[]>> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
};
const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const WHITE = 255;
const INK = 0;
const FRAME = 128;

export interface ContactSheet {
  png: Buffer;
  width: number;
  height: number;
}

function blank(width: number, height: number): RgbImage {
  return { width, height, data: Buffer.alloc(width * height * 3, WHITE) };
}

function fill(canvas: RgbImage, box: Box, value: number): void {
  const right = Math.min(canvas.width, box.x + box.width);
  const bottom = Math.min(canvas.height, box.y + box.height);
  for (let y = Math.max(0, box.y); y < bottom; y++) {
    const start = (y * canvas.width + Math.max(0, box.x)) * 3;
    canvas.data.fill(value, start, (y * canvas.width + right) * 3);
  }
}

/** A one-pixel frame along the box's edges. */
function frame(canvas: RgbImage, box: Box): void {
  const { x, y, width, height } = box;
  fill(canvas, { x, y, width, height: 1 }, FRAME);
  fill(canvas, { x, y: y + height - 1, width, height: 1 }, FRAME);
  fill(canvas, { x, y, width: 1, height }, FRAME);
  fill(canvas, { x: x + width - 1, y, width: 1, height }, FRAME);
}

/** The number in black, as tall as the band allows, from the band's left edge. */
function label(canvas: RgbImage, box: Box, n: number): void {
  const scale = Math.max(1, Math.floor((box.height - 4) / GLYPH_HEIGHT));
  const top = box.y + Math.floor((box.height - GLYPH_HEIGHT * scale) / 2);
  [...String(n)].forEach((digit, place) => {
    const left = box.x + 2 * scale + place * (GLYPH_WIDTH + 1) * scale;
    (DIGITS[digit] ?? []).forEach((row, dy) => {
      [...row].forEach((dot, dx) => {
        if (dot !== '#') return;
        const pixel = { x: left + dx * scale, y: top + dy * scale, width: scale, height: scale };
        fill(canvas, pixel, INK);
      });
    });
  });
}

/** The source span [start, end) that one target pixel covers (at least one source pixel). */
function span(target: number, targetSize: number, sourceSize: number): [number, number] {
  const start = Math.floor((target * sourceSize) / targetSize);
  const end = Math.floor(((target + 1) * sourceSize) / targetSize);
  return [Math.min(start, sourceSize - 1), Math.max(end, start + 1)];
}

/** The average color of a source rectangle (a box filter: fair when shrinking a crop). */
function average(source: RgbImage, xs: [number, number], ys: [number, number]): number[] {
  const sum = [0, 0, 0];
  for (let y = ys[0]; y < Math.min(ys[1], source.height); y++) {
    for (let x = xs[0]; x < Math.min(xs[1], source.width); x++) {
      const at = (y * source.width + x) * 3;
      for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + (source.data[at + c] ?? 0);
    }
  }
  const count = (Math.min(ys[1], source.height) - ys[0]) * (Math.min(xs[1], source.width) - xs[0]);
  return sum.map((total) => Math.round(total / Math.max(1, count)));
}

/** Draws the crop scaled into the box. */
function paste(canvas: RgbImage, source: RgbImage, box: Box): void {
  for (let dy = 0; dy < box.height; dy++) {
    const ys = span(dy, box.height, source.height);
    for (let dx = 0; dx < box.width; dx++) {
      const color = average(source, span(dx, box.width, source.width), ys);
      const at = ((box.y + dy) * canvas.width + box.x + dx) * 3;
      canvas.data[at] = color[0] ?? WHITE;
      canvas.data[at + 1] = color[1] ?? WHITE;
      canvas.data[at + 2] = color[2] ?? WHITE;
    }
  }
}

/** The sheet's pixels (before PNG encoding): exposed for tests and the bench. */
export function drawSheet(
  images: readonly RgbImage[],
  longEdge: number = SHEET_LONG_EDGE.light,
): RgbImage {
  const layout = layoutSheet(images, longEdge);
  const canvas = blank(layout.width, layout.height);
  layout.cells.forEach((cell, index) => {
    const image = images[index];
    if (!image) return;
    frame(canvas, cell.frame);
    label(canvas, cell.label, cell.n);
    paste(canvas, image, cell.image);
  });
  return canvas;
}

/** One numbered contact sheet of ≤ 10 crops as a PNG, its long edge within `longEdge`. */
export function composeSheet(
  images: readonly RgbImage[],
  longEdge: number = SHEET_LONG_EDGE.light,
): ContactSheet {
  const canvas = drawSheet(images, longEdge);
  return { png: encodePng(canvas), width: canvas.width, height: canvas.height };
}
