import { placedImages } from '../adapters/placed-images.js';
import { pageCount, readByOcr, readTextLayer } from '../adapters/readers.js';
import type { Raster } from '../domain/answer-marks.js';
import {
  horizontalRules,
  inkWithoutWords,
  PICTURE_LEVEL,
  ruledTables,
  scanFigures,
} from '../domain/ink-regions.js';
import { linkMedia, type MediaLink } from '../domain/media-links.js';
import {
  figuresFromImages,
  withoutRegionWords,
  type MediaRegion,
} from '../domain/media-regions.js';
import type { PageText } from '../domain/page.js';
import { hasUnreadableText, repairWithOcr } from '../domain/repair.js';
import {
  questionsFromPages,
  rasterCache,
  type ExtractedQuestion,
  type ReadingMode,
} from './extract-questions.js';

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

/**
 * Tables on every page, and pictures: the images a text page embeds, or dense ink on a scan
 * (M5.1). Vector drawings on text pages are not detected yet.
 */
async function findRegions(
  file: string,
  pages: readonly PageText[],
  raster: (page: number) => Promise<Raster>,
): Promise<MediaRegion[]> {
  const textPages = pages.filter((page) => page.visual).map((page) => page.page);
  const images = await placedImages(file, textPages);
  const regions: MediaRegion[] = [];
  for (const page of pages) {
    const image = await raster(page.page);
    const ink = inkWithoutWords(image, page);
    const tables = ruledTables(page, horizontalRules(ink, image));
    const figures = page.visual
      ? figuresFromImages(page, images.get(page.page) ?? [])
      : scanFigures(inkWithoutWords(image, page, PICTURE_LEVEL), image, page, tables);
    regions.push(...tables, ...figures);
  }
  return regions;
}

/** The pictures and tables the rules find on these pages, with their exact edges. */
export const pageRegions = (file: string, pages: readonly PageText[]) =>
  findRegions(file, pages, rasterCache(file));

export interface SourceReading {
  questions: ExtractedQuestion[];
  /** Figures and tables with the question each belongs to (M5.2). */
  media: MediaLink[];
}

/** Questions and their figures from pages already read; tables are kept as images. */
export async function readSource(file: string, pages: readonly PageText[]): Promise<SourceReading> {
  const raster = rasterCache(file);
  const regions = await findRegions(file, pages, raster);
  const readable = withoutRegionWords(pages, regions);
  const questions = await questionsFromPages(file, readable, raster, regions);
  return { questions, media: linkMedia(regions, questions) };
}

/** Rules-first extraction (M3.3): questions, options and pen-marked answers, with page numbers. */
export async function extractQuestions(
  file: string,
  mode: ReadingMode,
): Promise<ExtractedQuestion[]> {
  return (await readSource(file, await readPages(file, mode))).questions;
}
