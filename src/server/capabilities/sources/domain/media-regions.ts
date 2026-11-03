import type { Box, PageText } from './page.js';

/** A picture (ECG, X-ray, photo, chart) or a ruled table found on a page (M5.1). */
export interface MediaRegion {
  page: number;
  box: Box;
  kind: 'figure' | 'table';
  /** The image's own resolution when the PDF embeds it; null when found on a scan. */
  ppi: number | null;
}

/** An embedded image as the PDF places it (see adapters/placed-images). */
export interface PlacedImageLike {
  box: Box;
  pixelWidth: number;
  pixelHeight: number;
}

/** Smaller than this (points) is a bullet, an icon or a pen stroke, not a figure. */
const MIN_SIDE = 36;
/** A region larger than this share of the page is the page itself (a scan, a frame). */
const MAX_PAGE_SHARE = 0.6;
/** An image over this many printed words is an overlay (handwriting layer), not a figure. */
const MAX_WORDS_UNDER_IMAGE = 4;

export const area = (box: Box) => Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0);

export const intersect = (a: Box, b: Box): Box => ({
  x0: Math.max(a.x0, b.x0),
  y0: Math.max(a.y0, b.y0),
  x1: Math.min(a.x1, b.x1),
  y1: Math.min(a.y1, b.y1),
});

const centerInside = (box: Box, outer: Box) => {
  const x = (box.x0 + box.x1) / 2;
  const y = (box.y0 + box.y1) / 2;
  return x >= outer.x0 && x <= outer.x1 && y >= outer.y0 && y <= outer.y1;
};

export const wordsInside = (page: PageText, box: Box) =>
  page.words.filter((word) => centerInside(word.box, box)).length;

/** Sized like a figure: not a speck, not the whole page. */
export function figureSized(page: PageText, box: Box): boolean {
  const pageBox = { x0: 0, y0: 0, x1: page.width, y1: page.height };
  const onPage = area(intersect(box, pageBox));
  return (
    box.x1 - box.x0 >= MIN_SIDE &&
    box.y1 - box.y0 >= MIN_SIDE &&
    onPage >= area(box) * 0.8 &&
    onPage <= area(pageBox) * MAX_PAGE_SHARE
  );
}

const touches = (a: Box, b: Box) =>
  Math.abs(a.x1 - b.x0) < 2 ||
  Math.abs(b.x1 - a.x0) < 2 ||
  Math.abs(a.y1 - b.y0) < 2 ||
  Math.abs(b.y1 - a.y0) < 2;

/** One tile of a layer drawn edge to edge in same-size pieces (a handwriting overlay). */
const isTile = (image: PlacedImageLike, images: readonly PlacedImageLike[]) =>
  images.some(
    (other) =>
      other !== image &&
      other.pixelWidth === image.pixelWidth &&
      other.pixelHeight === image.pixelHeight &&
      touches(image.box, other.box),
  );

/** Embedded images that are figures on a text page; overlays and page backgrounds are not. */
export function figuresFromImages(
  page: PageText,
  images: readonly PlacedImageLike[],
): MediaRegion[] {
  return images
    .filter((image) => figureSized(page, image.box) && !isTile(image, images))
    .filter((image) => wordsInside(page, image.box) <= MAX_WORDS_UNDER_IMAGE)
    .map((image) => ({
      page: page.page,
      box: image.box,
      kind: 'figure' as const,
      ppi: Math.round((image.pixelWidth / (image.box.x1 - image.box.x0)) * 72),
    }));
}

/**
 * Pages without the words inside tables and pictures: a table is kept as an image (FR-05-009)
 * and words OCR read inside an X-ray are not question text.
 */
export function withoutRegionWords(
  pages: readonly PageText[],
  regions: readonly MediaRegion[],
): PageText[] {
  return pages.map((page) => {
    const boxes = regions.filter((region) => region.page === page.page).map((r) => r.box);
    if (boxes.length === 0) return page;
    const words = page.words.filter((word) => !boxes.some((box) => centerInside(word.box, box)));
    return { ...page, words };
  });
}
