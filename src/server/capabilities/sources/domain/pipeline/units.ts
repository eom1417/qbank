// M34 P2, lesson D1.1 in code: a page as ordered units (text lines, pasted images, filler).
import { isRtlText } from '../bidi.js';
import { splitColumns } from '../columns.js';
import type { Box, PageWord } from '../page.js';
import type { FillerKind } from './filler.js';
import type { ImageClass } from './image-class.js';

export type UnitKind = 'text_line' | 'image' | 'filler';

/**
 * Where a unit's text came from: the PDF text layer, OCR of a scanned page, words the text
 * layer holds in a font other than the body's (device handwriting), or OCR of an image.
 */
type UnitSource = 'text_layer' | 'ocr' | 'off_body_font' | 'image';

export interface Unit {
  /** "p3-u12": stable for a file. */
  id: string;
  page: number;
  /** PDF points, origin at the top-left. */
  box: Box;
  kind: UnitKind;
  /** The line's text, or the OCR text of an image. Untrusted file content. */
  text: string | null;
  /** OCR of an image; `unreadable` when rendering or OCR failed twice (its text is unknown). */
  ocr: { words: number; confidence: number; unreadable?: boolean } | null;
  /** An image's OCR words in page points, read once and reused (the virtual text, P4). */
  words?: PageWord[];
  imageClass: ImageClass | null;
  /** For images: the content fingerprint (K5). */
  fingerprint: string | null;
  /** Reading order on the page, from 0. */
  order: number;
  /** Why a filler unit is filler; null for other kinds. */
  filler: FillerKind | null;
  source: UnitSource;
}

export type UnitDraft = Omit<Unit, 'id' | 'order'>;

export interface PageSize {
  page: number;
  width: number;
  height: number;
}

/** Units whose tops are this close (points) sit on one row: read across, by direction. */
const ROW_TOLERANCE = 4;

const byRow = (rtl: boolean) => (a: UnitDraft, b: UnitDraft) =>
  Math.abs(a.box.y0 - b.box.y0) > ROW_TOLERANCE
    ? a.box.y0 - b.box.y0
    : rtl
      ? b.box.x1 - a.box.x1
      : a.box.x0 - b.box.x0;

/**
 * Content units in reading order: columns as `splitColumns` finds them (left then right, right
 * then left on Arabic pages), top to bottom inside each. Units across the gutter (a title, a
 * wide picture) come before the columns when above them, after them otherwise.
 */
function readingOrder(size: PageSize, drafts: readonly UnitDraft[]): UnitDraft[] {
  const rtl = isRtlText(drafts.map((draft) => draft.text ?? '').join(' '));
  const owner = new Map<PageWord, UnitDraft>();
  const words = drafts.map((draft) => {
    const word: PageWord = { text: draft.text ?? '', box: draft.box, font: null };
    owner.set(word, draft);
    return word;
  });
  const groups = splitColumns({ ...size, words: [] }, words).map((group) =>
    group.map((word) => owner.get(word) as UnitDraft).sort(byRow(rtl)),
  );
  if (groups.length < 3) return groups.flat();
  const [spanning = [], ...columns] = groups;
  const top = Math.min(...columns.flat().map((draft) => draft.box.y0));
  const above = spanning.filter((draft) => draft.box.y0 < top);
  const below = spanning.filter((draft) => draft.box.y0 >= top);
  return [...above, ...columns.flat(), ...below];
}

/** A page's units with ids and reading order; filler follows the content, top to bottom. */
export function orderPage(size: PageSize, drafts: readonly UnitDraft[]): Unit[] {
  const content = readingOrder(
    size,
    drafts.filter((draft) => draft.kind !== 'filler'),
  );
  const filler = drafts.filter((draft) => draft.kind === 'filler').sort(byRow(false));
  return [...content, ...filler].map((draft, order) => ({
    ...draft,
    id: `p${size.page}-u${order}`,
    order,
  }));
}
