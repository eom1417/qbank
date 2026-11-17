import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pageLines } from '../domain/lines.js';
import type { Box, PageWord } from '../domain/page.js';
import { parsePpm, type RgbImage } from '../domain/pipeline/rgb-image.js';
import { parseTesseractTsv } from './readers.js';
import { readBytes, runTool, withTempDir } from './run-tool.js';

/** Regions are rendered at up to this resolution (OCR of small pasted text needs it)… */
const REGION_DPI = 300;
/** …and smaller when that would pass this many pixels on the longest side. */
const MAX_SIDE = 2400;

export interface RegionOcr {
  /** Words in PDF points of the page (not of the region). */
  words: PageWord[];
  /** Mean Tesseract word confidence, 0–100; 0 without words. */
  confidence: number;
  /** The words as reading lines, one per row. */
  text: string;
}

/** The resolution a region is rendered at: sharp, but never a huge bitmap. */
export function regionDpi(box: Box, ceiling = REGION_DPI): number {
  const longest = Math.max(1, box.x1 - box.x0, box.y1 - box.y0);
  return Math.max(24, Math.min(ceiling, Math.floor((MAX_SIDE * 72) / longest)));
}

/** Mean confidence of the word rows (level 5) of Tesseract TSV that hold text. */
function meanConfidence(tsv: string): number {
  const scores = tsv
    .split('\n')
    .map((row) => row.split('\t'))
    .filter((cells) => cells[0] === '5' && (cells[11] ?? '').trim() !== '')
    .map((cells) => Number(cells[10]))
    .filter((score) => Number.isFinite(score) && score >= 0);
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

/** Shifts words read inside a region to page coordinates. */
const onPage = (word: PageWord, box: Box): PageWord => ({
  ...word,
  box: {
    x0: word.box.x0 + box.x0,
    y0: word.box.y0 + box.y0,
    x1: word.box.x1 + box.x0,
    y1: word.box.y1 + box.y0,
  },
});

const ppm = (image: RgbImage) =>
  Buffer.concat([Buffer.from(`P6\n${image.width} ${image.height}\n255\n`, 'ascii'), image.data]);

/**
 * Reads a rendered region with Tesseract (English and Arabic). `box` is where the region sits
 * on the page and `dpi` the resolution it was rendered at.
 */
export function ocrImage(image: RgbImage, page: number, box: Box, dpi: number): Promise<RegionOcr> {
  return withTempDir(async (dir) => {
    const path = join(dir, 'region.ppm');
    await writeFile(path, ppm(image));
    const tsv = (await runTool('tesseract', [path, 'stdout', '-l', 'eng+ara', 'tsv'])).toString();
    const local = parseTesseractTsv(tsv, dpi);
    const size = { page, width: box.x1 - box.x0, height: box.y1 - box.y0 };
    const text = pageLines({ ...size, words: local }, null)
      .map((line) => line.text)
      .join('\n');
    return { words: local.map((word) => onPage(word, box)), confidence: meanConfidence(tsv), text };
  });
}

/** Renders only `box` of `page` as RGB with poppler (`pdftoppm`, PPM by default), never the whole page. */
export function renderRegion(file: string, page: number, box: Box, dpi: number): Promise<RgbImage> {
  const px = (points: number) => String(Math.max(1, Math.round((points * dpi) / 72)));
  const area = ['-x', px(box.x0), '-y', px(box.y0), '-W', px(box.x1 - box.x0)];
  const args = [...area, '-H', px(box.y1 - box.y0), '-r', String(dpi)];
  return withTempDir(async (dir) => {
    const root = join(dir, 'region');
    const pages = ['-f', String(page), '-l', String(page)];
    await runTool('pdftoppm', ['-singlefile', ...pages, ...args, file, root]);
    return parsePpm(await readBytes(`${root}.ppm`));
  });
}
