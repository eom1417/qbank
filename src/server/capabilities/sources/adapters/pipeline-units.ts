import { bodyFontFamilies, pageLines, type TextLine } from '../domain/lines.js';
import { area, wordsInside } from '../domain/media-regions.js';
import type { Box, PageText } from '../domain/page.js';
import { familyOf, type FamilyVerdict } from '../domain/pipeline/family.js';
import {
  fingerprint,
  pageSizedFiller,
  placeImages,
  repeatedImages,
} from '../domain/pipeline/filler.js';
import { classifyImage, measureImage } from '../domain/pipeline/image-class.js';
import { readingScore, wantsSecondReading } from '../domain/pipeline/picture-lines.js';
import type { RgbImage } from '../domain/pipeline/rgb-image.js';
import { orderPage, type PageSize, type Unit, type UnitDraft } from '../domain/pipeline/units.js';
import { dropRunningLines } from '../domain/running-lines.js';
import { placedImages, type PlacedImage } from './placed-images.js';
import { readScan, readTextLayer } from './readers.js';
import { readRegion, renderRegion } from './region-image.js';

/**
 * Fewer text-layer words than this, and a picture as large as the page (or none at all): the
 * page is a scan, read by OCR as today. A page built of pasted pictures is not: its pictures
 * become image units, each read by its own OCR.
 */
const MIN_LAYER_WORDS = 3;
/** Fingerprints are taken from a small rendering: cheap, and stable across renders. */
const PRINT_DPI = 48;
/** Images read side by side (each one renders and runs Tesseract). */
const PARALLEL = 4;
/** A page-sized image with this many text-layer words over it is an OCR'd scan's page. */
const SCAN_LAYER_WORDS = 4;
/** A frame covers at least this share of its page. */
const WHOLE_PAGE_SHARE = 0.85;
/** Page-sized images are judged (frame, watermark) from a coarse rendering. */
const PAGE_DPI = 72;

export interface PageUnits {
  size: PageSize;
  /** No text layer: the lines come from OCR of the page. */
  scanned: boolean;
  units: Unit[];
}

export interface FileUnits {
  pages: PageUnits[];
  family: FamilyVerdict;
}

interface PageSource {
  text: PageText;
  scanned: boolean;
  images: PlacedImage[];
}

/** Runs `work` on every item, a few at a time (each one renders and runs Tesseract). */
export async function inParallel<T, R>(
  items: readonly T[],
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    for (let index = next++; index < items.length; index = next++)
      results[index] = await work(items[index] as T);
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, worker));
  return results;
}

const lineDraft = (line: TextLine, source: UnitDraft['source'], running: boolean): UnitDraft => ({
  page: line.page,
  box: line.box,
  kind: running ? 'filler' : 'text_line',
  text: line.text,
  ocr: null,
  imageClass: null,
  fingerprint: null,
  filler: running ? 'running_line' : null,
  source,
});

/** Body lines, plus the words in other fonts (device handwriting) as their own lines. */
function linesOf(source: PageSource, body: ReadonlySet<string> | null) {
  if (source.scanned) return { body: pageLines(source.text, null), off: [] };
  const lines = pageLines(source.text, body);
  const used = new Set(lines.flatMap((line) => line.words));
  const rest = source.text.words.filter((word) => !used.has(word));
  return {
    body: lines,
    off: rest.length > 0 ? pageLines({ ...source.text, words: rest }, null) : [],
  };
}

function textDrafts(sources: readonly PageSource[]): UnitDraft[] {
  const body = bodyFontFamilies(sources.filter((s) => !s.scanned).map((s) => s.text));
  const read = sources.map((source) => ({ source, ...linesOf(source, body) }));
  const all = read.flatMap((page) => page.body);
  const heights = new Map(sources.map((s) => [s.text.page, s.text.height] as const));
  const kept = new Set(dropRunningLines(all, heights));
  return read.flatMap(({ source, body: lines, off }) => [
    ...lines.map((line) => lineDraft(line, source.scanned ? 'ocr' : 'text_layer', !kept.has(line))),
    ...off.map((line) => lineDraft(line, 'off_body_font', false)),
  ]);
}

const clip = (box: Box, size: PageText): Box => ({
  x0: Math.max(0, box.x0),
  y0: Math.max(0, box.y0),
  x1: Math.min(size.width, box.x1),
  y1: Math.min(size.height, box.y1),
});

interface PageImage {
  source: PageSource;
  placement: 'content' | 'page_sized' | 'ink_overlay' | 'decor';
  page: number;
  box: Box;
  /** Filled for content and page-sized images once rendered. */
  print: string;
}

const fillerDraft = (image: PageImage, filler: UnitDraft['filler']): UnitDraft => ({
  page: image.page,
  box: image.box,
  kind: 'filler',
  text: null,
  ocr: null,
  imageClass: null,
  fingerprint: image.print || null,
  filler,
  source: 'image',
});

/** A screenshot whose first reading shows a numbered stem without options is read again. */
const SECOND_READING = { wanted: wantsSecondReading, score: readingScore };

/**
 * A pasted image as a unit: rendered sharp, read by OCR once (its words kept), measured and
 * classified. An image OCR cannot read stays a picture, marked unreadable.
 */
async function contentDraft(file: string, image: PageImage): Promise<UnitDraft> {
  const read = await readRegion(file, image.page, image.box, SECOND_READING);
  const { ocr } = read;
  const textArea = ocr.words.reduce((sum, word) => sum + area(word.box), 0);
  const stats = {
    words: ocr.words.length,
    confidence: ocr.confidence,
    textAreaRatio: textArea / Math.max(1, area(image.box)),
  };
  const words = ocr.words.map((word) => word.box);
  const measured = read.image ? measureImage(read.image) : null;
  const outside = read.image
    ? measureImage(read.image, coverMask(read.image, image.box, words, read.dpi))
    : null;
  return {
    ...fillerDraft(image, null),
    kind: 'image',
    text: ocr.text,
    ocr: {
      words: stats.words,
      confidence: Math.round(stats.confidence),
      unreadable: read.unreadable,
    },
    words: ocr.words,
    imageClass: measured && outside ? classifyImage(stats, measured, outside) : 'unsure',
  };
}

/** Pixels of a region under `cover` boxes (the page's words and smaller images), to skip. */
function coverMask(rgb: RgbImage, region: Box, cover: readonly Box[], dpi: number): Uint8Array {
  const mask = new Uint8Array(rgb.width * rgb.height);
  const px = (points: number, size: number) =>
    Math.max(0, Math.min(size, Math.round((points * dpi) / 72)));
  for (const box of cover) {
    const [x0, x1] = [px(box.x0 - region.x0, rgb.width) - 1, px(box.x1 - region.x0, rgb.width) + 1];
    const [y0, y1] = [px(box.y0 - region.y0, rgb.height) - 1, px(box.y1 - region.y0, rgb.height)];
    for (let y = Math.max(0, y0); y <= Math.min(rgb.height - 1, y1); y++)
      mask.fill(1, y * rgb.width + Math.max(0, x0), y * rgb.width + Math.min(rgb.width, x1));
  }
  return mask;
}

/** A page-sized image: a scan's page, a frame or a watermark; otherwise real content. */
async function pageSizedDraft(file: string, image: PageImage): Promise<UnitDraft> {
  const { source } = image;
  if (source.scanned) return fillerDraft(image, 'scan_page');
  const rgb = await renderRegion(file, image.page, image.box, PAGE_DPI).catch(() => null);
  if (!rgb) return contentDraft(file, image);
  // Smaller content pictures are skipped, not the overlay's tiles (they would hide everything).
  const placed = placeImages(source.text, source.images);
  const smaller = source.images
    .filter((other) => placed.get(other) === 'content')
    .map((other) => other.box)
    .filter((b) => area(b) < area(image.box));
  const cover = [...source.text.words.map((word) => word.box), ...smaller];
  const stats = measureImage(rgb, coverMask(rgb, image.box, cover, PAGE_DPI));
  const printed = { ...image, print: fingerprint(rgb) };
  const wordsOver = wordsInside(source.text, image.box) > SCAN_LAYER_WORDS;
  const page = { x0: 0, y0: 0, x1: source.text.width, y1: source.text.height };
  const wholePage = area(image.box) >= area(page) * WHOLE_PAGE_SHARE;
  const filler = pageSizedFiller(stats, { scanned: false, wordsOver, wholePage });
  return filler ? fillerDraft(printed, filler) : contentDraft(file, printed);
}

/** Every image of every page, sorted by how it sits there; content images get a fingerprint. */
async function pageImages(file: string, sources: readonly PageSource[]): Promise<PageImage[]> {
  const listed = sources.flatMap((source) =>
    [...placeImages(source.text, source.images)].map(([image, placement]) => ({
      source,
      placement,
      page: source.text.page,
      box: clip(image.box, source.text),
      print: '',
    })),
  );
  await inParallel(
    listed.filter((image) => image.placement === 'content'),
    async (image) => {
      // A region that will not render keeps no print: it is never taken for a repeat.
      const small = await renderRegion(file, image.page, image.box, PRINT_DPI).catch(() => null);
      image.print = small ? fingerprint(small) : '';
    },
  );
  return listed;
}

async function imageDrafts(file: string, sources: readonly PageSource[]): Promise<UnitDraft[]> {
  const images = await pageImages(file, sources);
  const content = images.filter((image) => image.placement === 'content');
  const repeated = repeatedImages(content, sources.length);
  return inParallel(images, (image) => {
    const { placement } = image;
    if (placement === 'ink_overlay' || placement === 'decor')
      return Promise.resolve(fillerDraft(image, placement));
    if (repeated.has(image)) return Promise.resolve(fillerDraft(image, 'repeated'));
    return placement === 'content' ? contentDraft(file, image) : pageSizedDraft(file, image);
  });
}

function isScanPage(page: PageText, images: readonly PlacedImage[]): boolean {
  const placements = [...placeImages(page, images).values()];
  return placements.includes('page_sized') || !placements.includes('content');
}

async function readSources(file: string): Promise<PageSource[]> {
  const layer = await readTextLayer(file);
  const placed = await placedImages(
    file,
    layer.map((page) => page.page),
  );
  return Promise.all(
    layer.map(async (page) => {
      const images = placed.get(page.page) ?? [];
      const scanned = page.words.length < MIN_LAYER_WORDS && isScanPage(page, images);
      const scan = scanned ? await readScan(file, page.page, 'auto') : null;
      const text = scan ? { ...scan, width: page.width, height: page.height } : page;
      return { text, scanned, images };
    }),
  );
}

/**
 * Turns every page of a PDF into ordered units (M34 P2): text lines, pasted images with their
 * OCR, class and fingerprint, and filler; plus the document's family (D0.1). No AI.
 */
export async function buildUnits(file: string): Promise<FileUnits> {
  const sources = await readSources(file);
  const drafts = [...textDrafts(sources), ...(await imageDrafts(file, sources))];
  const pages = sources.map((source) => {
    const size = { page: source.text.page, width: source.text.width, height: source.text.height };
    const own = drafts.filter((draft) => draft.page === size.page);
    return { size, scanned: source.scanned, units: orderPage(size, own) };
  });
  const units = pages.flatMap((page) => page.units);
  return {
    pages,
    family: familyOf(
      pages.map((page) => page.size),
      units,
    ),
  };
}
