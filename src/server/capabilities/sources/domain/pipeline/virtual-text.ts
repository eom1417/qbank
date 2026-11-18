// M34 P4, levels 2 and 6 in code: one virtual text layer for the rule parser. The page's own
// lines and the OCR lines of every picture of printed words, in reading order, each picture
// read as a page inside the page (D6.1). No AI.
import { attachKeys, type QuestionKeys } from '../answer-keys.js';
import { isDoubtfulKey } from '../key-lines.js';
import { separateKeys, type SeparateOptions } from '../key-pass.js';
import { optionLabel, questionLabel } from '../labels.js';
import type { TextLine } from '../lines.js';
import type { Box, PageWord } from '../page.js';
import { keysByPlace } from './key-places.js';
import { pictureKey, pictureLines } from './picture-lines.js';
import { isTagLine } from './tags.js';
import { parseQuestions, type ParsedQuestion, type PlacedFigure } from '../questions.js';
import { dropRunningLines } from '../running-lines.js';
import type { PageSize, Unit } from './units.js';

/** The OCR words of one picture, in page points. */
export interface PictureWords {
  unitId: string;
  words: PageWord[];
}

interface VirtualLine {
  line: TextLine;
  /** The unit it came from: a text line, or the picture it was read in. */
  unitId: string;
  fromPicture: boolean;
}

export interface VirtualText {
  /** Every line in reading order across the file. */
  lines: VirtualLine[];
  /** Each content unit's place in that order: its first line, or between two lines. */
  order: Map<string, number>;
  /** Content units by id (no filler). */
  units: Map<string, Unit>;
  /** Images lying over the page's printed lines: a background or a mark, never content. */
  covers: Set<string>;
}

export interface VirtualPage {
  size: PageSize;
  units: readonly Unit[];
}

/** Pictures read as text: printed words, tables, and unsure images OCR found words in. */
const TEXT_CLASSES = new Set(['text_picture', 'table', 'unsure']);
const MIN_PICTURE_WORDS = 3;

/** An image whose OCR words are worth reading into the virtual text. */
export const readsAsText = (unit: Unit): boolean =>
  unit.kind === 'image' &&
  TEXT_CLASSES.has(unit.imageClass ?? '') &&
  (unit.ocr?.words ?? 0) >= MIN_PICTURE_WORDS;

const boxKey = (page: number, box: Box) => `${page}:${box.x0}:${box.y0}:${box.x1}:${box.y1}`;

/** A box beside another may still overlap its end by this share of its own width. */
const SIDE_OVERLAP = 0.1;

/** `box` sits beside `line`: on the same rows, to one side of it. */
export function besideLine(box: Box, line: Box): boolean {
  const rows = Math.min(box.y1, line.y1) - Math.max(box.y0, line.y0) > 0;
  const across = Math.min(box.x1, line.x1) - Math.max(box.x0, line.x0);
  return rows && across <= (box.x1 - box.x0) * SIDE_OVERLAP;
}

const printedLine = (unit: Unit) => unit.kind === 'text_line' && unit.source !== 'off_body_font';

const centreInside = (inner: Box, outer: Box) => {
  const [x, y] = [(inner.x0 + inner.x1) / 2, (inner.y0 + inner.y1) / 2];
  return x >= outer.x0 && x <= outer.x1 && y >= outer.y0 && y <= outer.y1;
};

/**
 * A page's content units in reading order, except that a picture pasted beside printed lines
 * (a note next to the options) follows the last of those lines: it never splits them.
 */
export function pageFlow(units: readonly Unit[]): Unit[] {
  const flow = units.filter((unit) => unit.kind !== 'filler');
  for (const image of flow.filter((unit) => unit.kind === 'image')) {
    const from = flow.indexOf(image);
    const beside = flow.findLastIndex(
      (unit, index) => index > from && printedLine(unit) && besideLine(image.box, unit.box),
    );
    if (beside < 0) continue;
    flow.splice(from, 1);
    flow.splice(beside, 0, image);
  }
  return flow;
}

/** A line along an image's edge (this share of its height) touches it; it is not under it. */
const EDGE_SHARE = 0.1;

const inner = (box: Box): Box => {
  const edge = (box.y1 - box.y0) * EDGE_SHARE;
  return { ...box, y0: box.y0 + edge, y1: box.y1 - edge };
};

/** Images over the page's printed lines (the centre of one lies well inside, off its edges). */
const coversOf = (units: readonly Unit[]) =>
  units
    .filter((unit) => unit.kind === 'image')
    .filter((image) => units.some((u) => printedLine(u) && centreInside(u.box, inner(image.box))))
    .map((image) => image.id);

/** A question, option or key line: what makes an unsure picture worth reading as text. */
const questionShaped = (text: string) =>
  questionLabel(text) !== null || optionLabel(text) !== null || pictureKey(text) !== null;

interface Builder {
  lines: VirtualLine[];
  order: Map<string, number>;
  units: Map<string, Unit>;
  covers: Set<string>;
}

function addUnit(
  builder: Builder,
  unit: Unit,
  layer: ReadonlyMap<string, TextLine>,
  pictures: ReadonlyMap<string, TextLine[]>,
) {
  builder.units.set(unit.id, unit);
  const own = layer.get(boxKey(unit.page, unit.box));
  const read = unit.kind === 'text_line' && unit.source !== 'off_body_font' && own ? [own] : [];
  const picture = builder.covers.has(unit.id) ? [] : (pictures.get(unit.id) ?? []);
  const lines = unit.kind === 'image' ? picture : read;
  builder.order.set(unit.id, lines.length > 0 ? builder.lines.length : builder.lines.length - 0.5);
  const fromPicture = unit.kind === 'image';
  for (const line of lines) builder.lines.push({ line, unitId: unit.id, fromPicture });
}

/**
 * The virtual text of a file: `layer` holds the page's own reading lines (text layer or a
 * scan's OCR, as `pageLines` reads them); `words` the OCR words of pictures read as text.
 * Text lines and pictures take the units' reading order (`pageFlow`); device handwriting
 * is left out, and so is the text of an image over printed lines.
 */
export function virtualText(
  pages: readonly VirtualPage[],
  layer: readonly TextLine[],
  words: readonly PictureWords[],
): VirtualText {
  const byBox = new Map(layer.map((line) => [boxKey(line.page, line.box), line]));
  const sizes = new Map(pages.map((page) => [page.size.page, page.size]));
  const unitPage = new Map(pages.flatMap((p) => p.units.map((unit) => [unit.id, p.size.page])));
  const unsure = new Set(
    pages.flatMap((page) => page.units.filter((u) => u.imageClass === 'unsure').map((u) => u.id)),
  );
  const pictures = new Map(
    words.flatMap(({ unitId, words: own }) => {
      const size = sizes.get(unitPage.get(unitId) ?? -1);
      const lines = size ? pictureLines(size.page, own) : [];
      const keep = !unsure.has(unitId) || lines.some((line) => questionShaped(line.text));
      return keep && lines.length > 0 ? [[unitId, lines] as const] : [];
    }),
  );
  const covers = new Set(pages.flatMap((page) => coversOf(page.units)));
  const builder: Builder = { lines: [], order: new Map(), units: new Map(), covers };
  for (const page of pages)
    for (const unit of pageFlow(page.units)) addUnit(builder, unit, byBox, pictures);
  return builder;
}

/** A line that only closes the open stem or option (the parser's section rule). */
const closer = (line: TextLine): TextLine => ({
  page: line.page,
  text: '~~~~~~',
  box: { ...line.box, y1: line.box.y0 },
  words: [],
  rtl: false,
  start: line.start,
});

/** Two lines on either side of a picture's edge: different units, one of them a picture. */
const pictureEdge = (here: VirtualLine | undefined, last: VirtualLine | undefined) =>
  !!here && !!last && here.unitId !== last.unitId && (here.fromPicture || last.fromPicture);

/**
 * Lines for `parseQuestions`: a picture's edge closes the open stem or option, so text read in
 * one picture never runs on into the next picture or the page (each is a page inside the page).
 */
export function parserLines(
  text: VirtualText,
  kept: readonly TextLine[],
  picturesClose = true,
): TextLine[] {
  const origin = new Map(text.lines.map((virtual) => [virtual.line, virtual]));
  const result: TextLine[] = [];
  let last: VirtualLine | undefined;
  for (const line of kept) {
    const here = origin.get(line);
    if (picturesClose && pictureEdge(here, last)) result.push(closer(line));
    result.push(line);
    last = here ?? last;
  }
  return result;
}

export interface PictureKey {
  unitId: string;
  number: number;
  letter: string;
  /** The explanation printed after the letter, up to the next key in the picture. */
  text: string;
}

/** Keys printed in pictures, for numbers some question has (each picture read on its own). */
export function pictureKeys(text: VirtualText, numbers: ReadonlySet<number>): PictureKey[] {
  const keys: PictureKey[] = [];
  let open: PictureKey | null = null;
  for (const { line, unitId, fromPicture } of text.lines) {
    if (open && open.unitId !== unitId) open = null;
    const key = fromPicture ? pictureKey(line.text) : null;
    if (key && numbers.has(key.number)) {
      open = { unitId, ...key };
      keys.push(open);
    } else if (open) open.text = `${open.text} ${line.text}`.trim();
  }
  return keys;
}

/** Most question numbers carry a word ("Question: 2"), so each label surely starts one (M38). */
const LABELLED_SHARE = 0.8;
const MIN_LABELS = 3;

function labelsQuestions(lines: readonly TextLine[]): boolean {
  const labels = lines.flatMap((line) => {
    const label = questionLabel(line.text);
    return label ? [label] : [];
  });
  const prefixed = labels.filter((label) => label.prefixed).length;
  return prefixed >= MIN_LABELS && prefixed >= labels.length * LABELLED_SHARE;
}

export interface ReadOptions extends SeparateOptions {
  /**
   * A picture's edge closes the open stem or option (pasted screenshots in notes). Off for a
   * file nobody wrote on (M38): its tables and figures sit inside the question they belong to.
   */
  picturesClose?: boolean;
}

export interface VirtualReading {
  questions: ParsedQuestion[];
  keys: QuestionKeys[];
  /** Orders of the lines no question, key or explanation read (tags, case texts, notes). */
  free: Set<number>;
  /** Units at least one of whose lines a question, key or explanation read. */
  consumed: Set<string>;
  /** Orders of every line nothing read, in pictures too (no tags or doubtful keys). */
  unread: Set<number>;
}

const lastPage = (question: ParsedQuestion | null) =>
  question?.spans.at(-1)?.page ?? Number.NEGATIVE_INFINITY;

/**
 * Questions read in pictures that sit under a question read from the page's own text are
 * excerpts of another bank pasted as its explanation (level 5), not questions of the file.
 */
function dropExcerpts(questions: readonly ParsedQuestion[], origin: ReadonlyMap<Box, VirtualLine>) {
  const kept: ParsedQuestion[] = [];
  let textOwner: ParsedQuestion | null = null;
  for (const question of questions) {
    const fromPicture = origin.get(question.spans[0]?.box as Box)?.fromPicture ?? false;
    const last = lastPage(textOwner);
    if (fromPicture && question.page <= last + 1) continue;
    textOwner = fromPicture ? null : question;
    kept.push(question);
  }
  return kept;
}

/**
 * A question read in a picture keeps only options read in that picture or the next one (a
 * screenshot cut in two): letters found pictures later belong to something else (D6.1).
 */
function trimStrayOptions(questions: readonly ParsedQuestion[], text: VirtualText) {
  const byWord = new Map<Box, VirtualLine>();
  for (const virtual of text.lines)
    for (const box of [virtual.line.box, ...virtual.line.words.map((w) => w.box)])
      byWord.set(box, virtual);
  const pictures = [...new Set(text.lines.filter((l) => l.fromPicture).map((l) => l.unitId))];
  for (const question of questions) {
    const stem = byWord.get(question.spans[0]?.box as Box);
    if (!stem?.fromPicture) continue;
    const next = pictures[pictures.indexOf(stem.unitId) + 1];
    const own = (box: Box) => [stem.unitId, next].includes(byWord.get(box)?.unitId);
    const stray = question.options.findIndex((option) => !own(option.letterBox));
    if (stray < 0) continue;
    question.options = question.options.slice(0, stray);
    question.spans = question.spans.filter((span) => own(span.box));
  }
}

const isAside = (text: string) => isTagLine(text) || isDoubtfulKey(text);

/**
 * The existing rule path over the virtual text: running lines out, keys and explanations
 * apart, questions parsed (pictures' edges close open text), keys attached.
 */
export function readVirtual(
  text: VirtualText,
  heights: ReadonlyMap<number, number>,
  figures: readonly PlacedFigure[],
  options: ReadOptions = {},
): VirtualReading {
  const all = text.lines.map((virtual) => virtual.line);
  const kept = dropRunningLines(all, heights);
  // Exam tags and doubtful keys stand between a question and its key: read apart (Q53, D4.1).
  const asides = kept.filter((line) => isAside(line.text));
  const separated = separateKeys(
    kept.filter((line) => !isAside(line.text)),
    options,
  );
  const origin = new Map(text.lines.map((virtual) => [virtual.line.box, virtual]));
  const questions = dropExcerpts(
    parseQuestions(parserLines(text, separated.lines, options.picturesClose ?? true), figures, {
      spanToNextLabel: options.picturesClose === false && labelsQuestions(separated.lines),
    }),
    origin,
  );
  trimStrayOptions(questions, text);
  const spans = new Set(questions.flatMap((question) => question.spans.map((span) => span.box)));
  const keys = keysByPlace(questions, attachKeys(questions, separated), text, separated.inline);
  const left = new Set([...separated.lines, ...asides]);
  const free = new Set<number>();
  const consumed = new Set<string>();
  const stays = new Set(kept);
  const unread = new Set<number>();
  text.lines.forEach(({ line, unitId, fromPicture }, at) => {
    if (!stays.has(line)) return;
    if (spans.has(line.box) || !left.has(line)) consumed.add(unitId);
    else if (!fromPicture || !consumed.has(unitId)) free.add(at);
    if (left.has(line) && !spans.has(line.box) && !isAside(line.text)) unread.add(at);
  });
  return { questions, keys, free, consumed, unread };
}
