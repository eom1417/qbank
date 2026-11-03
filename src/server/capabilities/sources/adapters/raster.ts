import type { Raster } from '../domain/answer-marks.js';
import { readBytes, renderPgm, withTempDir } from './run-tool.js';

/** Parses a binary PGM (P5) image as written by `pdftoppm -gray`. */
function parsePgm(data: Buffer, scale: number): Raster {
  const header = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(data.subarray(0, 64).toString('latin1'));
  if (!header?.[1] || !header[2]) throw new Error('not a PGM image');
  const width = Number(header[1]);
  const height = Number(header[2]);
  const offset = header[0].length;
  return {
    width,
    height,
    scale,
    pixels: new Uint8Array(data.subarray(offset, offset + width * height)),
  };
}

/** Renders one page in grayscale with poppler; 100 dpi is enough to see pen marks. */
export function renderPage(file: string, page: number, dpi = 100): Promise<Raster> {
  return withTempDir(async (dir) =>
    parsePgm(await readBytes(await renderPgm(file, page, dpi, dir)), dpi / 72),
  );
}
