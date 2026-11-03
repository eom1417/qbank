/** A box in PDF points, origin at the top-left of the page. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * One word as read from a page: from the PDF text layer (with its font) or from OCR (no font).
 * Words are untrusted file content; they are only ever treated as data.
 */
export interface PageWord {
  text: string;
  box: Box;
  font: string | null;
  /** OCR's own line id: words beside each other in two columns are not one line. */
  line?: string;
}

export interface PageText {
  /** 1-based page number in the source file. */
  page: number;
  width: number;
  height: number;
  words: PageWord[];
  /** True for a PDF text layer, which stores right-to-left words in visual order. */
  visual?: boolean;
}

export const boxHeight = (box: Box): number => box.y1 - box.y0;

/** The two boxes share some area. */
export const overlaps = (a: Box, b: Box): boolean =>
  Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

export const unionBox = (boxes: readonly Box[]): Box => ({
  x0: Math.min(...boxes.map((b) => b.x0)),
  y0: Math.min(...boxes.map((b) => b.y0)),
  x1: Math.max(...boxes.map((b) => b.x1)),
  y1: Math.max(...boxes.map((b) => b.y1)),
});

/**
 * Font family without subset prefix, style or vendor suffix, so bold and regular match:
 * "AAAAAF+TimesNewRomanPS-BoldMT" and "TimesNewRomanPSMT" are both "TimesNewRoman".
 * Typed questions share one family; handwriting converted by the device uses another.
 */
export function fontFamily(font: string): string {
  const base = font.replace(/^[A-Z]{6}\+/, '').split(/[-_,]/)[0] ?? font;
  return base.replace(/(PS)?(MT)?$/, '') || base;
}
