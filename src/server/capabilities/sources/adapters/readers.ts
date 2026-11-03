import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PageText, PageWord } from '../domain/page.js';
import { readBytes, renderPgm, runTool, withTempDir } from './run-tool.js';
import { parseStext } from './stext.js';

const OCR_DPI = 200;

export interface PageRange {
  from: number;
  to: number;
}

/** The PDF's own text layer, with fonts, read by MuPDF (all pages, or `range`). */
export function readTextLayer(file: string, range?: PageRange): Promise<PageText[]> {
  // mutool needs a real output file: it cannot write structured text to a pipe.
  return withTempDir(async (dir) => {
    const out = join(dir, 'text.stext');
    const pages = range ? [`${range.from}-${range.to}`] : [];
    await runTool('mutool', ['draw', '-q', '-F', 'stext', '-o', out, file, ...pages], 600_000);
    return parseStext(await readFile(out, 'utf8'), range?.from ?? 1);
  });
}

export async function pageCount(file: string): Promise<number> {
  const info = (await runTool('pdfinfo', [file])).toString('utf8');
  return Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? 0);
}

/** Parses Tesseract TSV (level 5 = word) into words in PDF points. */
export function parseTesseractTsv(tsv: string, dpi: number): PageWord[] {
  const toPoints = 72 / dpi;
  return tsv
    .split('\n')
    .slice(1)
    .map((row) => row.split('\t'))
    .filter((cells) => cells[0] === '5' && (cells[11] ?? '').trim() !== '')
    .map((cells) => {
      const [left = 0, top = 0, width = 0, height = 0] = cells
        .slice(6, 10)
        .map((value) => Number(value) * toPoints);
      const box = { x0: left, y0: top, x1: left + width, y1: top + height };
      const line = cells.slice(2, 5).join('.');
      return { text: (cells[11] ?? '').trim(), box, font: null, line };
    });
}

/**
 * Reads a page as a scan would be read: render it, then OCR in Arabic and English. Used for
 * scanned files, and to measure how much the text layer is worth on files that have one.
 */
export function readByOcr(file: string, page: number): Promise<PageText> {
  return withTempDir(async (dir) => {
    const imagePath = await renderPgm(file, page, OCR_DPI, dir);
    const tsv = await runTool('tesseract', [imagePath, 'stdout', '-l', 'eng+ara', 'tsv'], 300_000);
    const header = (await readBytes(imagePath)).subarray(0, 32).toString('latin1');
    const size = /^P5\s+(\d+)\s+(\d+)/.exec(header);
    const toPoints = 72 / OCR_DPI;
    return {
      page,
      width: Number(size?.[1]) * toPoints,
      height: Number(size?.[2]) * toPoints,
      words: parseTesseractTsv(tsv.toString('utf8'), OCR_DPI),
    };
  });
}
