import type { PageUnits } from '../../adapters/pipeline-units.js';
import { pageLines, type TextLine } from '../../domain/lines.js';
import { fontFamily, type PageText, type PageWord } from '../../domain/page.js';
import { area, intersect } from '../../domain/media-regions.js';
import { pictureLines } from '../../domain/pipeline/picture-lines.js';
import type { Unit } from '../../domain/pipeline/units.js';
import { pageFlow, readsAsText } from '../../domain/pipeline/virtual-text.js';
import type { LineSource } from '../contract.js';

// M39 step 2: one page's reading lines, every word in one of them: the page's own lines (text
// layer or OCR), the words in other fonts as their own lines, and the words read in pictures,
// each placed where its unit sits in the page's reading order.

export interface DraftLine {
  line: TextLine;
  source: LineSource;
  unitId: string;
  confidence: number | null;
  deviceNote: boolean;
  /** Place in the page's reading order, then inside that place. */
  rank: number;
  sub: number;
}

export interface PageInput {
  text: PageText;
  /** The page's units (null when the units do not know the page). */
  units: PageUnits | null;
  /** The body fonts of the file (null: every word is body). */
  body: ReadonlySet<string> | null;
  /** Pictures over printed lines: their words repeat the print under them. */
  covers: ReadonlySet<string>;
}

/** Typed on a device over the page: its fonts' names start with a dot (".SFUI"). */
const deviceWord = (word: PageWord) => !!word.font && fontFamily(word.font).startsWith('.');

/**
 * Words over the print: typed on a device, or in a font outside the body drawn over a body word
 * (a stamp, an annotation). Printed words never overlap one another.
 */
function overPrint(text: PageText, body: ReadonlySet<string> | null): (word: PageWord) => boolean {
  const inBody = (word: PageWord) => !!word.font && !!body?.has(fontFamily(word.font));
  const printed = text.words.filter(inBody);
  const covers = (word: PageWord) =>
    printed.some((under) => area(intersect(under.box, word.box)) >= area(word.box) / 2);
  const stamped = (word: PageWord) => !!word.font && !inBody(word) && covers(word);
  return (word) => deviceWord(word) || stamped(word);
}

const boxKey = (line: { page: number; box: TextLine['box'] }) =>
  `${line.page}:${line.box.x0}:${line.box.y0}:${line.box.x1}:${line.box.y1}`;

/**
 * The page's own lines: body lines first, then the words left out of them as their own lines.
 * A word typed on a device never stays on a printed line (a short one can pass for a label):
 * it goes with the words left out, so a printed option stays printed.
 */
function ownLines(input: PageInput): TextLine[] {
  const { text, units } = input;
  const body = units?.scanned ? null : input.body;
  const lines = printedOnly(pageLines(text, body), text, body);
  if (!body) return lines;
  const used = new Set(lines.flatMap((line) => line.words));
  const rest = text.words.filter((word) => !used.has(word));
  return rest.length > 0 ? [...lines, ...pageLines({ ...text, words: rest }, null)] : lines;
}

/** The lines with their device words taken out; a line of device words only stays as it is. */
function printedOnly(lines: readonly TextLine[], text: PageText, body: ReadonlySet<string> | null) {
  const over = overPrint(text, body);
  return lines.flatMap((line) => {
    const printed = line.words.filter((word) => !over(word));
    if (printed.length === line.words.length || printed.length === 0) return [line];
    return pageLines({ ...text, words: printed }, null);
  });
}

/** A unit's place: its index in the page flow; a filler line sits before the next flow unit. */
function ranker(units: readonly Unit[]) {
  const flow = pageFlow(units);
  const at = new Map(flow.map((unit, index) => [unit.id, index]));
  const before = (index: number) => (index < 0 ? flow.length : index) - 0.5;
  return {
    unit: (unit: Unit) =>
      at.get(unit.id) ?? before(flow.findIndex((other) => other.order > unit.order)),
    line: (line: TextLine) => before(flow.findIndex((other) => other.box.y0 >= line.box.y0)),
  };
}

function textDrafts(input: PageInput, rank: ReturnType<typeof ranker>): DraftLine[] {
  const units = input.units?.units ?? [];
  const byBox = new Map(units.filter((u) => u.kind !== 'image').map((u) => [boxKey(u), u]));
  const source: LineSource = input.units?.scanned ? 'ocr' : 'text';
  const over = overPrint(input.text, input.units?.scanned ? null : input.body);
  return ownLines(input).map((line, index) => {
    const unit = byBox.get(boxKey(line));
    return {
      line,
      source,
      unitId: unit?.id ?? `p${line.page}-line${index}`,
      confidence: null,
      deviceNote: line.words.some(over),
      rank: unit ? rank.unit(unit) : rank.line(line),
      sub: unit ? unit.order : line.box.y0,
    };
  });
}

function pictureDrafts(input: PageInput, rank: ReturnType<typeof ranker>): DraftLine[] {
  const pictures = (input.units?.units ?? []).filter(
    (unit) => readsAsText(unit) && !input.covers.has(unit.id),
  );
  return pictures.flatMap((unit) =>
    pictureLines(input.text.page, unit.words ?? []).map((line, index) => ({
      line,
      source: 'picture' as const,
      unitId: unit.id,
      confidence: unit.ocr?.confidence ?? null,
      deviceNote: false,
      rank: rank.unit(unit),
      sub: index,
    })),
  );
}

/** Every line of one page in reading order. */
export function pageDrafts(input: PageInput): DraftLine[] {
  const rank = ranker(input.units?.units ?? []);
  return [...textDrafts(input, rank), ...pictureDrafts(input, rank)].sort(
    (a, b) => a.rank - b.rank || a.sub - b.sub,
  );
}
