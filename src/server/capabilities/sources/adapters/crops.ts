import { join } from 'node:path';
import type { Raster } from '../domain/answer-marks.js';
import type { Box } from '../domain/page.js';
import { parsePgm } from './raster.js';
import { readBytes, runTool, withTempDir } from './run-tool.js';

/** Crops are rendered at this resolution, smaller when that would pass `MAX_SIDE` pixels. */
const CROP_DPI = 150;
const MAX_SIDE = 1600;

/** A region of a page as a PNG to keep, and in grayscale to measure its quality. */
export interface Crop {
  png: Buffer;
  width: number;
  height: number;
  gray: Raster;
}

/** Renders only `box` of `page` with poppler (never the whole page: FR-06-008). */
export function cropRegion(file: string, page: number, box: Box): Promise<Crop> {
  const longest = Math.max(box.x1 - box.x0, box.y1 - box.y0);
  const dpi = Math.min(CROP_DPI, Math.floor((MAX_SIDE * 72) / longest));
  const px = (points: number) => Math.max(1, Math.round((points * dpi) / 72));
  const area = [
    '-x',
    px(box.x0),
    '-y',
    px(box.y0),
    '-W',
    px(box.x1 - box.x0),
    '-H',
    px(box.y1 - box.y0),
  ];
  const base = ['-singlefile', '-r', dpi, '-f', page, '-l', page, ...area].map(String);
  return withTempDir(async (dir) => {
    await runTool('pdftoppm', ['-png', ...base, file, join(dir, 'crop')]);
    await runTool('pdftoppm', ['-gray', ...base, file, join(dir, 'crop')]);
    const gray = parsePgm(await readBytes(join(dir, 'crop.pgm')), dpi / 72);
    const png = await readBytes(join(dir, 'crop.png'));
    return { png, width: gray.width, height: gray.height, gray };
  });
}
