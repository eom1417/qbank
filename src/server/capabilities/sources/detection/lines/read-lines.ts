import { buildUnits, inParallel, scanText, type FileUnits } from '../../adapters/pipeline-units.js';
import { readByOcr, readTextLayer } from '../../adapters/readers.js';
import { bodyFontFamilies } from '../../domain/lines.js';
import type { PageText } from '../../domain/page.js';
import { hasUnreadableText, repairWithOcr } from '../../domain/repair.js';
import { virtualText } from '../../domain/pipeline/virtual-text.js';
import type { FileLines, Line } from '../contract.js';
import { measureLayout } from './layout.js';
import { pageDrafts, type DraftLine } from './page-lines.js';

// M39 step 2 (plan §3): every word of the file in exactly one line, in reading order. The same
// path for any file: no file type or name decides anything here.

/** What step 2 reads a file with; the bench may pass cached units and pages. */
export interface LinesReader {
  units(file: string): Promise<FileUnits>;
  /** The page's own words: its text layer, or OCR for a scanned page. */
  pages(file: string, units: FileUnits): Promise<PageText[]>;
}

const scannedPages = (units: FileUnits) =>
  new Set(units.pages.filter((page) => page.scanned).map((page) => page.size.page));

export const defaultLinesReader: LinesReader = {
  units: buildUnits,
  pages: async (file, units) => {
    const scanned = scannedPages(units);
    return inParallel(await readTextLayer(file), async (page) => {
      if (scanned.has(page.page)) return scanText(file, page);
      return hasUnreadableText(page) ? repairWithOcr(page, await readByOcr(file, page.page)) : page;
    });
  },
};

const toLine = (draft: DraftLine, id: number): Line => ({
  id,
  page: draft.line.page,
  box: draft.line.box,
  text: draft.line.text,
  words: draft.line.words,
  source: draft.source,
  unitId: draft.unitId,
  rtl: draft.line.rtl,
  confidence: draft.confidence,
  deviceNote: draft.deviceNote,
});

/** The file's lines from its units and pages (pure: the tests and the bench call it). */
export function linesOf(units: FileUnits, pages: readonly PageText[]): FileLines {
  const scanned = scannedPages(units);
  const body = bodyFontFamilies(pages.filter((page) => !scanned.has(page.page)));
  const { covers } = virtualText(units.pages, [], []);
  const byPage = new Map(units.pages.map((page) => [page.size.page, page]));
  const ordered = [...pages].sort((a, b) => a.page - b.page);
  const lines = ordered
    .flatMap((text) => pageDrafts({ text, units: byPage.get(text.page) ?? null, body, covers }))
    .map(toLine);
  return { lines, units, pages: ordered, layout: measureLayout(lines) };
}

export async function readLines(
  fileName: string,
  reader: LinesReader = defaultLinesReader,
): Promise<FileLines> {
  const units = await reader.units(fileName);
  return linesOf(units, await reader.pages(fileName, units));
}
