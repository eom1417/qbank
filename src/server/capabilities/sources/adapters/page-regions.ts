import { placedImages } from './placed-images.js';
import { rasterCache } from './raster.js';
import type { Raster } from '../domain/answer-marks.js';
import {
  horizontalRules,
  inkWithoutWords,
  PICTURE_LEVEL,
  ruledTables,
  scanFigures,
} from '../domain/ink-regions.js';
import { figuresFromImages, type MediaRegion } from '../domain/media-regions.js';
import type { PageText } from '../domain/page.js';

/**
 * Tables on every page, and pictures: the images a text page embeds, or dense ink on a scan
 * (M5.1). Vector drawings on text pages are not detected yet.
 */
export async function findRegions(
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
