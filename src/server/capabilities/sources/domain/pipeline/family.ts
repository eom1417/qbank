// M34 P2, lesson D0.1 in code: the document's family from signals across the whole file, and
// which lessons run for it. The family adds no rules; it only saves lessons that cannot apply.
import { explanationStart, inlineAnswer, isKeyHeading, keyEntries } from '../key-lines.js';
import { optionLabel, questionLabel } from '../labels.js';
import { area } from '../media-regions.js';
import type { PageSize, Unit } from './units.js';

export type DocumentFamily =
  'annotated_notes' | 'printed_key' | 'exam_paper' | 'exported_bank' | 'scan' | 'other';

export interface FamilySignals {
  pages: number;
  /** Pages read from a PDF text layer. */
  textLayerShare: number;
  /** Pages that are a scan (one picture of the page, read by OCR). */
  scanPageShare: number;
  /** Area of content images over page area. */
  imageAreaShare: number;
  /** Pages carrying annotation ink: a handwriting image or the device's ink overlay. */
  inkPageShare: number;
  questionLines: number;
  optionLines: number;
  /** "Correct answer: B"-style lines. */
  inlineKeyLines: number;
  /** Typed key tables ("1. A  2. C") and their headings. */
  keyTableLines: number;
  explanationLines: number;
}

const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

const pagesWhere = (units: readonly Unit[], test: (unit: Unit) => boolean) =>
  new Set(units.filter(test).map((unit) => unit.page)).size;

const isInk = (unit: Unit) => unit.imageClass === 'handwriting' || unit.filler === 'ink_overlay';

function lineCounts(units: readonly Unit[]) {
  const lines = units
    .filter((unit) => unit.kind === 'text_line' && unit.source !== 'off_body_font')
    .map((unit) => unit.text ?? '');
  const count = (test: (line: string) => boolean) => lines.filter(test).length;
  return {
    questionLines: count((line) => questionLabel(line) !== null),
    optionLines: count((line) => optionLabel(line) !== null),
    inlineKeyLines: count((line) => inlineAnswer(line) !== null),
    keyTableLines: count((line) => isKeyHeading(line) || (keyEntries(line)?.length ?? 0) >= 2),
    explanationLines: count((line) => explanationStart(line) !== null),
  };
}

export function familySignals(sizes: readonly PageSize[], units: readonly Unit[]): FamilySignals {
  const pages = sizes.length;
  const pageArea = sizes.reduce((sum, size) => sum + size.width * size.height, 0);
  const imageArea = units
    .filter((unit) => unit.kind === 'image')
    .reduce((sum, unit) => sum + area(unit.box), 0);
  return {
    pages,
    textLayerShare: share(
      pagesWhere(units, (unit) => unit.source === 'text_layer'),
      pages,
    ),
    scanPageShare: share(
      pagesWhere(units, (unit) => unit.filler === 'scan_page'),
      pages,
    ),
    imageAreaShare: share(imageArea, pageArea),
    inkPageShare: share(pagesWhere(units, isInk), pages),
    ...lineCounts(units),
  };
}

/** Scanned pages on this share of the file: a scan. */
const SCAN_MIN_PAGES = 0.5;
/** Ink on this share of pages: notes someone corrected by hand. */
const NOTES_MIN_INK = 0.3;
/** Key lines for this share of the questions: the key is printed with them. */
const INLINE_KEY_SHARE = 0.3;
/** Explanations for this share of the inline keys: an exported question bank. */
const BANK_EXPLANATION_SHARE = 0.5;
const KEY_TABLE_MIN_LINES = 3;
const EXAM_MIN_QUESTIONS = 3;

function typedFamily(signals: FamilySignals): DocumentFamily {
  const inline = signals.inlineKeyLines >= signals.questionLines * INLINE_KEY_SHARE;
  const keyed = signals.inlineKeyLines > 0 && inline;
  if (keyed && signals.explanationLines >= signals.inlineKeyLines * BANK_EXPLANATION_SHARE)
    return 'exported_bank';
  if (keyed || signals.keyTableLines >= KEY_TABLE_MIN_LINES) return 'printed_key';
  if (signals.questionLines >= EXAM_MIN_QUESTIONS) return 'exam_paper';
  return 'other';
}

export function documentFamily(signals: FamilySignals): DocumentFamily {
  if (signals.pages === 0) return 'other';
  // Device ink first: corrected notes may be built of pasted pictures with no text layer.
  if (signals.inkPageShare >= NOTES_MIN_INK) return 'annotated_notes';
  if (signals.scanPageShare >= SCAN_MIN_PAGES) return 'scan';
  return typedFamily(signals);
}

const UNITS = ['D1.1', 'D1.2', 'D1.3'];
const ANCHORS = ['D2.1', 'D2.2', 'D2.3'];
const OWNERSHIP = ['D3.1', 'D3.2', 'D3.3', 'D3.4'];
const HAND_MARKS = ['D4.3', 'D4.4', 'D4.5'];
const PASTED = ['D6.1', 'D6.2'];
const CHECKS = ['D6.3', 'D6.4', 'D7.1', 'D7.2', 'D7.3', 'D7.4'];

const lessonsOf = (evidence: readonly string[], pasted: readonly string[]) => [
  'D0.1',
  ...UNITS,
  ...ANCHORS,
  ...OWNERSHIP,
  ...evidence,
  'D4.6',
  'D5',
  ...pasted,
  ...CHECKS,
];

/**
 * Lessons per family, in curriculum order. `other` runs none: the file is a new shape and the
 * import stops with a report (Q44).
 */
export const FAMILY_LESSONS: Readonly<Record<DocumentFamily, readonly string[]>> = {
  annotated_notes: lessonsOf(['D4.1', 'D4.2', ...HAND_MARKS], PASTED),
  scan: lessonsOf(['D4.1', 'D4.2', ...HAND_MARKS], PASTED),
  printed_key: lessonsOf(['D4.1', 'D4.2'], []),
  exported_bank: lessonsOf(['D4.1'], PASTED),
  exam_paper: lessonsOf(['D4.2', ...HAND_MARKS], []),
  other: [],
};

export interface FamilyVerdict {
  family: DocumentFamily;
  lessons: readonly string[];
  signals: FamilySignals;
}

export function familyOf(sizes: readonly PageSize[], units: readonly Unit[]): FamilyVerdict {
  const signals = familySignals(sizes, units);
  const family = documentFamily(signals);
  return { family, lessons: FAMILY_LESSONS[family], signals };
}
