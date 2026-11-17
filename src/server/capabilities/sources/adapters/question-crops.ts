// M34 P4b: each question's area (stem to last option) as one picture for a vision lesson. Spots
// on several pages are stacked top to bottom; every spot is rendered alone with poppler.
import { createHash } from 'node:crypto';
import { overlaps, type Box } from '../domain/page.js';
import type { PipelineQuestion, Spot } from '../domain/pipeline/question.js';
import type { RgbImage } from '../domain/pipeline/rgb-image.js';
import { renderRegion } from './region-image.js';

/**
 * About the width a crop gets inside the light model's 1000 px contact sheet; rendering wider only
 * makes the sheet shrink it again.
 */
const CROP_WIDTH = 900;
const MIN_DPI = 36;
const MAX_DPI = 150;
/** Hand marks reach past the printed words: a ring around a letter, a tick after the text. */
const PAD_POINTS = 14;
/** White rows between two stacked spots. */
const GAP = 6;
const WHITE = 255;

export interface QuestionCrop {
  key: string;
  image: RgbImage;
  /** sha256 of the pixels: the lesson item's content fingerprint (K5). */
  fingerprint: string;
}

const padded = (box: Box): Box => ({
  x0: Math.max(0, box.x0 - PAD_POINTS),
  y0: Math.max(0, box.y0 - PAD_POINTS),
  x1: box.x1 + PAD_POINTS,
  y1: box.y1 + PAD_POINTS,
});

/** One resolution for all of a question's spots, so its parts keep the same scale. */
export function cropDpi(spots: readonly Spot[]): number {
  const widest = Math.max(1, ...spots.map((spot) => spot.box.x1 - spot.box.x0 + 2 * PAD_POINTS));
  return Math.max(MIN_DPI, Math.min(MAX_DPI, Math.floor((CROP_WIDTH * 72) / widest)));
}

/** The pictures one below the other, left-aligned, on white. */
export function stackImages(images: readonly RgbImage[]): RgbImage {
  const width = Math.max(1, ...images.map((image) => image.width));
  const height = images.reduce((sum, image) => sum + image.height, 0) + GAP * (images.length - 1);
  const data = Buffer.alloc(width * Math.max(1, height) * 3, WHITE);
  let top = 0;
  for (const image of images) {
    for (let y = 0; y < image.height; y++) {
      const row = image.data.subarray(y * image.width * 3, (y + 1) * image.width * 3);
      row.copy(data, (top + y) * width * 3);
    }
    top += image.height + GAP;
  }
  return { width, height: Math.max(1, height), data };
}

export function cropFingerprint(image: RgbImage): string {
  const hash = createHash('sha256').update(`${image.width}x${image.height}:`);
  return hash.update(image.data).digest('hex');
}

type Croppable = Pick<PipelineQuestion, 'key' | 'area' | 'options' | 'fromPicture'>;

/**
 * Printed pictures beside the options (films, screenshots, pasted pages) are blanked: they carry
 * circles and letters of their own that are not this question's marks. A picture touching an
 * option letter stays, and so does everything when the letters' spots are unknown or the
 * question was itself read from a picture.
 */
export function maskedBoxes(question: Croppable, page: number, pictures: readonly Spot[]): Box[] {
  const letters = question.options.map((option) => option.spot);
  if (question.fromPicture || letters.some((spot) => spot === null)) return [];
  const near = letters.flatMap((spot) => (spot?.page === page ? [padded(spot.box)] : []));
  return pictures
    .filter((picture) => picture.page === page)
    .map((picture) => picture.box)
    .filter((box) => !near.some((letter) => overlaps(letter, box)));
}

/** Paints `box` (page points) white on a region rendered from `origin` at `dpi`. */
export function blank(image: RgbImage, box: Box, origin: Box, dpi: number): void {
  const px = (points: number, size: number) =>
    Math.max(0, Math.min(size, Math.round((points * dpi) / 72)));
  const x0 = px(box.x0 - origin.x0, image.width);
  const x1 = px(box.x1 - origin.x0, image.width);
  for (let y = px(box.y0 - origin.y0, image.height); y < px(box.y1 - origin.y0, image.height); y++)
    image.data.fill(WHITE, (y * image.width + x0) * 3, (y * image.width + x1) * 3);
}

/** One question's crop, or null when it has no area. */
export async function cropQuestion(
  file: string,
  question: Croppable,
  pictures: readonly Spot[] = [],
  render = renderRegion,
): Promise<QuestionCrop | null> {
  if (question.area.length === 0) return null;
  const dpi = cropDpi(question.area);
  const parts: RgbImage[] = [];
  for (const spot of question.area) {
    const origin = padded(spot.box);
    const part = await render(file, spot.page, origin, dpi);
    for (const box of maskedBoxes(question, spot.page, pictures)) blank(part, box, origin, dpi);
    parts.push(part);
  }
  const image = parts.length === 1 && parts[0] ? parts[0] : stackImages(parts);
  return { key: question.key, image, fingerprint: cropFingerprint(image) };
}

/** The crops of these questions, in order; a question without an area is left out. */
export async function cropQuestions(
  file: string,
  questions: readonly Croppable[],
  pictures: readonly Spot[] = [],
  render = renderRegion,
): Promise<QuestionCrop[]> {
  const crops: QuestionCrop[] = [];
  for (const question of questions) {
    const crop = await cropQuestion(file, question, pictures, render);
    if (crop) crops.push(crop);
  }
  return crops;
}
