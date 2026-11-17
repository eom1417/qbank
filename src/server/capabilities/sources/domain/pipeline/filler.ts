// M34 P2, lesson D1.3 in code: what on a page is filler (frames, watermarks, logos, running
// lines, decorative bars, the handwriting overlay layer, a scan's own page image).
import {
  area,
  figureSized,
  figuresFromImages,
  intersect,
  type PlacedImageLike,
} from '../media-regions.js';
import type { Box, PageText } from '../page.js';
import { pixelLuma, type ImageStats } from './image-class.js';
import type { RgbImage } from './rgb-image.js';

export type FillerKind =
  'repeated' | 'decor' | 'frame' | 'watermark' | 'running_line' | 'ink_overlay' | 'scan_page';

const PRINT_SIDE = 16;

/**
 * The image's content fingerprint (K5): a 16×16 grey downscale, one bit per cell (brighter than
 * the mean or not), as 64 hex digits. The same picture rendered again gives the same print.
 */
export function fingerprint(image: RgbImage): string {
  const sums = new Array<number>(PRINT_SIDE * PRINT_SIDE).fill(0);
  const counts = new Array<number>(PRINT_SIDE * PRINT_SIDE).fill(0);
  const { width, height } = image;
  for (let y = 0; y < height; y++) {
    const row = Math.floor((y * PRINT_SIDE) / height) * PRINT_SIDE;
    for (let x = 0; x < width; x++) {
      const cell = row + Math.floor((x * PRINT_SIDE) / width);
      sums[cell] = (sums[cell] ?? 0) + pixelLuma(image, y * width + x);
      counts[cell] = (counts[cell] ?? 0) + 1;
    }
  }
  const means = sums.map((sum, cell) => sum / Math.max(1, counts[cell] ?? 1));
  const mean = means.reduce((a, b) => a + b, 0) / means.length;
  let hex = '';
  for (let nibble = 0; nibble < means.length; nibble += 4) {
    const bits = means.slice(nibble, nibble + 4).map((value): number => (value > mean ? 1 : 0));
    hex += bits.reduce((value, bit) => value * 2 + bit, 0).toString(16);
  }
  return hex;
}

/** Bits that differ between two fingerprints. */
export function printDistance(a: string, b: string): number {
  let distance = 0;
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    let xor = parseInt(a[index] ?? '0', 16) ^ parseInt(b[index] ?? '0', 16);
    for (; xor; xor >>= 1) distance += xor & 1;
  }
  return distance;
}

/** An image seen at the same place with the same print on this share of pages is filler… */
const REPEAT_SHARE = 0.3;
/** …and on at least this many pages (a two-page file repeats nothing). */
const REPEAT_MIN_PAGES = 3;
const SAME_PRINT_BITS = 8;
/** Points each edge may move between pages and still be "the same place". */
const SAME_PLACE = 12;

export interface PlacedPrint {
  page: number;
  box: Box;
  print: string;
}

const samePlace = (a: Box, b: Box) =>
  Math.abs(a.x0 - b.x0) <= SAME_PLACE &&
  Math.abs(a.y0 - b.y0) <= SAME_PLACE &&
  Math.abs(a.x1 - b.x1) <= SAME_PLACE &&
  Math.abs(a.y1 - b.y1) <= SAME_PLACE;

/** The images that repeat (logo, letterhead, frame): same print, same place, many pages. */
export function repeatedImages<T extends PlacedPrint>(images: readonly T[], pages: number): Set<T> {
  const needed = Math.max(REPEAT_MIN_PAGES, Math.ceil(pages * REPEAT_SHARE));
  const repeated = new Set<T>();
  for (const image of images) {
    const twins = images.filter(
      (other) =>
        samePlace(image.box, other.box) &&
        printDistance(image.print, other.print) <= SAME_PRINT_BITS,
    );
    if (new Set(twins.map((twin) => twin.page)).size >= needed) repeated.add(image);
  }
  return repeated;
}

/** Specks and thin decorative bars (points). */
const SPECK_SIDE = 4;
const BAR_ASPECT = 12;
const BAR_THICKNESS = 8;

export function isDecor(box: Box): boolean {
  const short = Math.min(box.x1 - box.x0, box.y1 - box.y0);
  const long = Math.max(box.x1 - box.x0, box.y1 - box.y0);
  return short < SPECK_SIDE || (short <= BAR_THICKNESS && long >= short * BAR_ASPECT);
}

/** A frame has a rule near each edge (share of the side). */
const FRAME_EDGE = 0.12;
/** A watermark leaves almost no dark ink outside the page's text and pictures. */
const WATERMARK_MAX_DARK = 0.003;

const nearBothEdges = (centres: readonly number[]) =>
  centres.some((at) => at <= FRAME_EDGE) && centres.some((at) => at >= 1 - FRAME_EDGE);

/**
 * A page-sized image is filler when it is a scanned page's own picture, a frame round the
 * whole page (`wholePage`), a faint
 * watermark, or the picture under an OCR'd scan's text layer (`wordsOver`); null when it is
 * real content (a full-page screenshot).
 */
export function pageSizedFiller(
  stats: ImageStats,
  page: { scanned: boolean; wordsOver: boolean; wholePage: boolean },
): 'scan_page' | 'frame' | 'watermark' | null {
  if (page.scanned) return 'scan_page';
  // A frame goes round the whole page; a large screenshot has its own border.
  const framed = nearBothEdges(stats.rows) && nearBothEdges(stats.columns);
  if (framed && page.wholePage) return 'frame';
  if (stats.darkShare <= WATERMARK_MAX_DARK) return 'watermark';
  // An OCR'd scan's picture fills the page; typed lines along a screenshot's edge do not make one.
  return page.wordsOver && page.wholePage ? 'scan_page' : null;
}

/** An image covering this share of its page is the page's background, frame or screenshot. */
const PAGE_SIZED_SHARE = 0.6;

/**
 * How an image sits on its page: `content` (a picture, a screenshot, a pen mark), `page_sized`
 * (decided from its pixels by `pageSizedFiller`), a tile of the device's `ink_overlay`, or `decor`.
 * Figures are what `figuresFromImages` keeps on a page without words; figure-sized images it
 * drops are overlay tiles, and so is any other image with a tile's pixel size.
 */
export function placeImages<T extends PlacedImageLike>(
  page: PageText,
  images: readonly T[],
): Map<T, 'content' | 'page_sized' | 'ink_overlay' | 'decor'> {
  const figures = new Set(figuresFromImages({ ...page, words: [] }, images).map((f) => f.box));
  const tiles = images.filter((image) => !figures.has(image.box) && figureSized(page, image.box));
  const tileSizes = new Set(tiles.map((tile) => `${tile.pixelWidth}x${tile.pixelHeight}`));
  const pageBox = { x0: 0, y0: 0, x1: page.width, y1: page.height };
  const placed = new Map<T, 'content' | 'page_sized' | 'ink_overlay' | 'decor'>();
  for (const image of images) {
    const onPage = area(intersect(image.box, pageBox));
    if (figures.has(image.box)) placed.set(image, 'content');
    else if (tileSizes.has(`${image.pixelWidth}x${image.pixelHeight}`))
      placed.set(image, 'ink_overlay');
    else if (onPage <= 0 || isDecor(intersect(image.box, pageBox))) placed.set(image, 'decor');
    else if (onPage >= area(pageBox) * PAGE_SIZED_SHARE) placed.set(image, 'page_sized');
    else placed.set(image, 'content');
  }
  return placed;
}
