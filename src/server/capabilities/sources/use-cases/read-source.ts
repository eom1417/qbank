import { detect } from '../detection/detect.js';
import { defaultLinesReader } from '../detection/lines/read-lines.js';
import { asExtractedQuestion, asKeptLinks } from './detection-output.js';
import { pageCount, readByOcr, readTextLayer } from '../adapters/readers.js';
import type { MediaLink } from '../domain/media-links.js';
import type { PageText } from '../domain/page.js';
import { hasUnreadableText, repairWithOcr } from '../domain/repair.js';
import { type ExtractedQuestion, type ReadingMode } from './extract-questions.js';

/** Text layer first; pages with unreadable glyphs get those lines from OCR instead. */
async function readHybrid(file: string): Promise<PageText[]> {
  const pages = await readTextLayer(file);
  const repaired: PageText[] = [];
  for (const page of pages) {
    repaired.push(
      hasUnreadableText(page) ? repairWithOcr(page, await readByOcr(file, page.page)) : page,
    );
  }
  return repaired;
}

async function readPages(file: string, mode: ReadingMode): Promise<PageText[]> {
  if (mode === 'text') return readHybrid(file);
  const pages: PageText[] = [];
  for (let page = 1; page <= (await pageCount(file)); page++)
    pages.push(await readByOcr(file, page));
  return pages;
}

export { pageRegions } from '../adapters/page-regions.js';

export interface SourceReading {
  questions: ExtractedQuestion[];
  /** Figures and tables with the question each belongs to (M5.2). */
  media: MediaLink[];
}

/** Questions and their figures from pages already read; tables are kept as images. */
export async function readSource(file: string, pages: readonly PageText[]): Promise<SourceReading> {
  const result = await detect(file, {
    lessons: null,
    reader: {
      units: async () => {
        const units = await defaultLinesReader.units(file);
        const included = new Set(pages.map((page) => page.page));
        const scanned = new Set(pages.filter((page) => !page.visual).map((page) => page.page));
        return {
          ...units,
          pages: units.pages
            .filter((page) => included.has(page.size.page))
            .map((page) => ({ ...page, scanned: scanned.has(page.size.page) })),
        };
      },
      pages: async () => [...pages],
    },
  });
  return {
    questions: result.questions.map(asExtractedQuestion),
    media: asKeptLinks(result.questions),
  };
}

/** Rules-first extraction (M3.3): questions, options and pen-marked answers, with page numbers. */
export async function extractQuestions(
  file: string,
  mode: ReadingMode,
): Promise<ExtractedQuestion[]> {
  return (await readSource(file, await readPages(file, mode))).questions;
}
