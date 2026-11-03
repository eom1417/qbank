import type { Raster } from './answer-marks.js';

/** How usable a kept image is (FR-06-006): a poor one holds its question for review. */
export interface MediaQuality {
  /** Mean edge strength (|Laplacian|): blurry or upscaled pictures score low. */
  sharpness: number;
  /** Spread of gray levels: washed-out or almost blank pictures score low. */
  contrast: number;
  /** The embedded image's own resolution; null for a picture on a scan. */
  ppi: number | null;
  low: boolean;
}

/** Below these a picture cannot be read reliably on a phone (calibrated on the fixtures). */
const MIN_PPI = 60;
const MIN_CONTRAST = 18;
const MIN_SHARPNESS = 2;

function contrastOf(pixels: Uint8Array): number {
  const mean = pixels.reduce((sum, value) => sum + value, 0) / Math.max(1, pixels.length);
  const variance =
    pixels.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, pixels.length);
  return Math.sqrt(variance);
}

function sharpnessOf({ width, height, pixels }: Raster): number {
  let total = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x;
      const laplacian =
        4 * (pixels[at] ?? 0) -
        (pixels[at - 1] ?? 0) -
        (pixels[at + 1] ?? 0) -
        (pixels[at - width] ?? 0) -
        (pixels[at + width] ?? 0);
      total += Math.abs(laplacian);
      count += 1;
    }
  return count === 0 ? 0 : total / count;
}

export function qualityOf(gray: Raster, ppi: number | null): MediaQuality {
  const sharpness = Math.round(sharpnessOf(gray) * 100) / 100;
  const contrast = Math.round(contrastOf(gray.pixels) * 100) / 100;
  const low =
    (ppi !== null && ppi < MIN_PPI) || contrast < MIN_CONTRAST || sharpness < MIN_SHARPNESS;
  return { sharpness, contrast, ppi, low };
}
