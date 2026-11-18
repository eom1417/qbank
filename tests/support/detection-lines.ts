import type { FileLines, Line } from '../../src/server/capabilities/sources/detection/contract.js';
import type { PageWord } from '../../src/server/capabilities/sources/domain/page.js';

// M39 step 3 fixtures: synthetic lines stacked down a page, every distance scalable.

export interface Spec {
  text: string;
  y: number;
  page?: number;
  x?: number;
  note?: boolean;
  /** Read by OCR in a picture (a pasted screenshot); the pictures' unit. */
  picture?: string;
  /** A table row: the first word alone, then the cells `cellGap` points further on. */
  cellGap?: number;
}

export const at = (text: string, y: number, more: Omit<Spec, 'text' | 'y'> = {}): Spec => ({
  text,
  y,
  ...more,
});

function wordsOf(spec: Spec, scale: number): PageWord[] {
  const x = (spec.x ?? 36) * scale;
  const [y0, y1] = [spec.y * scale, (spec.y + 12) * scale];
  let left = x;
  return spec.text.split(' ').map((text, index) => {
    if (index === 1 && spec.cellGap) left += spec.cellGap * scale;
    const box = { x0: left, y0, x1: left + 25 * scale, y1 };
    left += 30 * scale;
    return { text, box, font: null };
  });
}

/** A file of `specs` in reading order; every distance (and the layout) times `scale`. */
export function fileOf(specs: Spec[], scale = 1): FileLines {
  const lines: Line[] = specs.map((spec, id) => {
    const words = wordsOf(spec, scale);
    const box = {
      x0: words[0]?.box.x0 ?? 0,
      y0: spec.y * scale,
      x1: (words.at(-1)?.box.x1 ?? 0) + 0,
      y1: (spec.y + 12) * scale,
    };
    const unitId = spec.picture ?? `u${id}`;
    const base = { id, page: spec.page ?? 1, box, text: spec.text, words, unitId };
    const source = spec.picture ? ('picture' as const) : ('text' as const);
    const rest = { rtl: false, source, confidence: null };
    return { ...base, ...rest, deviceNote: spec.note ?? false };
  });
  const pageCount = Math.max(1, ...lines.map((line) => line.page));
  const pages = Array.from({ length: pageCount }, (_, index) => ({
    page: index + 1,
    width: 612 * scale,
    height: 792 * scale,
    words: [],
  }));
  const margins = new Map(pages.map((page) => [page.page, 36 * scale]));
  const layout = { lineHeight: 12 * scale, lineGap: 2 * scale, paragraphGap: 36 * scale, margins };
  return { lines, units: new Map() as never, pages, layout };
}
