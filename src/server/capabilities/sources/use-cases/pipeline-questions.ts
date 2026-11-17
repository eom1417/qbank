import { buildUnits, inParallel, type FileUnits } from '../adapters/pipeline-units.js';
import { renderPage } from '../adapters/raster.js';
import { readScan, readTextLayer } from '../adapters/readers.js';
import { ocrImage, regionDpi, renderRegion } from '../adapters/region-image.js';
import type { QuestionKeys } from '../domain/answer-keys.js';
import { inkAround, type Raster } from '../domain/answer-marks.js';
import { bodyFontFamilies, pageLines } from '../domain/lines.js';
import { fontFamily, type Box, type PageText, type PageWord } from '../domain/page.js';
import type { ParsedQuestion } from '../domain/questions.js';
import { buildQuestions, type QuestionParts } from '../domain/pipeline/build-questions.js';
import { caseGroups, optionDonor, type CaseGroup } from '../domain/pipeline/case.js';
import type { FamilyVerdict } from '../domain/pipeline/family.js';
import {
  frameOf,
  inkNotes,
  lineOrder,
  noteZones,
  placePictures,
  type QuestionFrame,
} from '../domain/pipeline/placement.js';
import type { PipelineQuestion } from '../domain/pipeline/question.js';
import type { RgbImage } from '../domain/pipeline/rgb-image.js';
import type { Unit } from '../domain/pipeline/units.js';
import {
  pictureKeys,
  readsAsText,
  readVirtual,
  virtualText,
  type PictureKey,
  type VirtualReading,
  type VirtualText,
} from '../domain/pipeline/virtual-text.js';
import { decideQuestion, rasterCache, type ExtractedQuestion } from './extract-questions.js';

// M34 P4a: a file's questions from its units, with no AI and no database: the virtual text
// through the existing rule parser, then ownership and placement of every picture.

/** What the pipeline reads a file with; the bench may pass cached readers. */
export interface PipelineReaders {
  units(file: string): Promise<FileUnits>;
  /** The page's own words: its text layer, or OCR for a scanned page. */
  pages(file: string, units: FileUnits): Promise<PageText[]>;
  /** OCR words of one picture, in page points. */
  pictureWords(file: string, unit: Unit): Promise<PageWord[]>;
  /** The page in grey, for pen marks at option letters. */
  raster(file: string): (page: number) => Promise<Raster>;
  /** The page in colour at `dpi`, for handwritten notes. */
  colour(file: string, page: PageText, dpi: number): Promise<RgbImage>;
}

/**
 * Pictures whose dark pixels are never a pen mark at an option letter: films and drawings. (A
 * text picture or table beside a letter may carry the overlay's circle; an unsure image may be
 * the mark itself.)
 */
const PRINTED_PICTURES = new Set(['figure']);
/** Notes are looked for on a coarse colour rendering of the page. */
const NOTE_DPI = 60;

const scannedPages = (units: FileUnits) =>
  new Set(units.pages.filter((page) => page.scanned).map((page) => page.size.page));

async function readPages(file: string, units: FileUnits): Promise<PageText[]> {
  const scanned = scannedPages(units);
  return Promise.all(
    (await readTextLayer(file)).map(async (page) =>
      scanned.has(page.page)
        ? { ...(await readScan(file, page.page, 'auto')), width: page.width, height: page.height }
        : page,
    ),
  );
}

async function readPicture(file: string, unit: Unit): Promise<PageWord[]> {
  const dpi = regionDpi(unit.box);
  const image = await renderRegion(file, unit.page, unit.box, dpi);
  return (await ocrImage(image, unit.page, unit.box, dpi)).words;
}

export const defaultReaders: PipelineReaders = {
  units: buildUnits,
  pages: readPages,
  pictureWords: readPicture,
  raster: (file) => rasterCache(file, renderPage),
  colour: (file, page, dpi) =>
    renderRegion(file, page.page, { x0: 0, y0: 0, x1: page.width, y1: page.height }, dpi),
};

/** The page's reading lines, and its printed words (body fonts; every word of a scan). */
function layerOf(pages: readonly PageText[], units: FileUnits) {
  const scanned = scannedPages(units);
  const body = bodyFontFamilies(pages.filter((page) => !scanned.has(page.page)));
  const bodyOnly = (page: PageText) => (scanned.has(page.page) ? null : body);
  const isPrinted = (page: PageText, word: PageWord) =>
    !bodyOnly(page) || !word.font || (body?.has(fontFamily(word.font)) ?? true);
  return {
    lines: pages.flatMap((page) => pageLines(page, bodyOnly(page))),
    printed: new Map(
      pages.map((page) => [page.page, page.words.filter((word) => isPrinted(page, word))]),
    ),
  };
}

/** Keys printed in pictures fill questions with no key yet; their text joins the explanation. */
function withPictureKeys(
  reading: VirtualReading,
  frames: readonly QuestionFrame[],
  keys: readonly PictureKey[],
  order: ReadonlyMap<string, number>,
): { keys: QuestionKeys[]; owners: Map<string, number> } {
  const merged = reading.keys.map((key) => ({ ...key }));
  const owners = new Map<string, number>();
  for (const key of keys) {
    const at = order.get(key.unitId) ?? 0;
    const named = frames.flatMap((frame, index) => (frame.number === key.number ? [index] : []));
    const owner = named.findLast((index) => (frames[index]?.stemAt ?? 0) <= at) ?? named[0];
    const slot = owner === undefined ? undefined : merged[owner];
    if (owner === undefined || !slot) continue;
    owners.set(key.unitId, owner);
    reading.consumed.add(key.unitId);
    if (!slot.key) Object.assign(slot, { key: [key.letter], keyFrom: 'section' });
    slot.explanation = [slot.explanation, key.text].filter(Boolean).join('\n') || null;
  }
  return { keys: merged, owners };
}

/** Members of a matching set take the options printed once for the set (answered by key only). */
function shareOptions(questions: readonly ParsedQuestion[], groups: readonly CaseGroup[]) {
  const shared = new Set<number>();
  for (const group of groups) {
    const donor = optionDonor(
      group,
      questions.map((question) => question.options.length),
    );
    const options = donor === null ? [] : (questions[donor]?.options ?? []);
    for (const index of group.questions) {
      const question = questions[index];
      if (!question || index === donor || options.length === 0) continue;
      question.options = options.map(unmarked);
      shared.add(index);
    }
  }
  return shared;
}

/** OCR's circle glyph on a picture's letter is the picture's own print, not a pen mark. */
const unmarked = (option: ParsedQuestion['options'][number]) => ({
  ...option,
  circledGlyph: false,
});

interface FileContext {
  file: string;
  readers: PipelineReaders;
  pages: PageText[];
  /** Printed words of each page: the body text and the words read in pictures. */
  printed: Map<number, Box[]>;
  text: VirtualText;
}

/** Each question's answer: its key, pen ink at its letters on the rendered page, explanation. */
async function answer(
  context: FileContext,
  questions: readonly ParsedQuestion[],
  keys: readonly QuestionKeys[],
  modes: { picture: ReadonlySet<number>; shared: ReadonlySet<number> },
): Promise<ExtractedQuestion[]> {
  const raster = context.readers.raster(context.file);
  const result: ExtractedQuestion[] = [];
  for (const [index, question] of questions.entries()) {
    // Ink is measured in grey: over a picture (radio buttons, ticks, film) it is no pen mark.
    const shared = modes.shared.has(index) || modes.picture.has(index);
    const inkOf = async (option: ParsedQuestion['options'][number]) =>
      shared
        ? 0
        : inkAround(
            await raster(option.page),
            option.letterBox,
            context.printed.get(option.page) ?? [],
          );
    const read = shared ? { ...question, options: question.options.map(unmarked) } : question;
    result.push(await decideQuestion(read, keys[index], shared ? 'ocr' : 'text', inkOf));
  }
  return result;
}

/** Handwritten notes (ink in a question's note zone, off print and letters), per question. */
async function notesOf(
  context: FileContext,
  questions: readonly ParsedQuestion[],
  frames: readonly QuestionFrame[],
): Promise<{ question: number; page: number; box: Box }[]> {
  const heights = new Map(context.pages.map((page) => [page.page, page.height]));
  const zones = noteZones(frames, heights);
  const pages = context.pages.filter((page) => zones.some((zone) => zone.page === page.page));
  const images = [...context.text.units.values()].filter((unit) => unit.kind === 'image');
  const found = await inParallel(pages, async (page) => {
    const letters = questions.flatMap((q) => q.options).filter((o) => o.page === page.page);
    const pictures = images.filter((unit) => unit.page === page.page).map((unit) => unit.box);
    const notes = inkNotes(
      {
        page: page.page,
        image: await context.readers.colour(context.file, page, NOTE_DPI),
        dpi: NOTE_DPI,
        printed: [...(context.printed.get(page.page) ?? []), ...pictures],
        letters: letters.map((option) => option.letterBox),
      },
      zones,
    );
    return notes.map((note) => ({ ...note, page: page.page }));
  });
  return found.flat();
}

/** The virtual text of a file: its units, page lines, and the words of pictures read as text. */
async function readText(file: string, units: FileUnits, readers: PipelineReaders) {
  const pages = await readers.pages(file, units);
  const layer = layerOf(pages, units);
  const textual = units.pages.flatMap((page) => page.units).filter(readsAsText);
  const words = await inParallel(textual, async (unit) => ({
    unitId: unit.id,
    words: await readers.pictureWords(file, unit),
  }));
  const text = virtualText(units.pages, layer.lines, words);
  // Print and figures: dark pixels there are no answer mark.
  const printed = new Map<number, Box[]>();
  const add = (page: number, boxes: Box[]) =>
    printed.set(page, [...(printed.get(page) ?? []), ...boxes]);
  for (const [page, own] of layer.printed)
    add(
      page,
      own.map((word) => word.box),
    );
  for (const { unitId, words: own } of words)
    add(
      text.units.get(unitId)?.page ?? 0,
      own.map((word) => word.box),
    );
  for (const unit of text.units.values())
    if (PRINTED_PICTURES.has(unit.imageClass ?? '')) add(unit.page, [unit.box]);
  return { file, readers, pages, printed, text } satisfies FileContext;
}

/** Figures the parser steps over: the pictures not read as text. */
const figuresOf = (text: VirtualText) =>
  [...text.units.values()]
    .filter((unit) => unit.kind === 'image' && !readsAsText(unit))
    .map((unit) => ({ page: unit.page, box: unit.box }));

async function readFile(context: FileContext): Promise<QuestionParts> {
  const { text } = context;
  const heights = new Map(context.pages.map((page) => [page.page, page.height]));
  const reading = readVirtual(text, heights, figuresOf(text));
  const order = lineOrder(text);
  const frames = reading.questions.map((question) => frameOf(question, order));
  const numbers = new Set(frames.map((frame) => frame.number));
  const picked = withPictureKeys(reading, frames, pictureKeys(text, numbers), text.order);
  const cases = caseGroups(frames, text, reading.free);
  const shared = shareOptions(reading.questions, cases);
  const picture = new Set(
    frames.flatMap((frame, index) => (text.lines[frame.stemAt]?.fromPicture ? [index] : [])),
  );
  const decided = await answer(context, reading.questions, picked.keys, { picture, shared });
  const owned = placePictures({
    frames,
    text,
    consumed: reading.consumed,
    cases,
    namedOwner: (unit) => picked.owners.get(unit.id) ?? null,
  });
  const notes = await notesOf(context, reading.questions, frames);
  return {
    parsed: reading.questions,
    decided,
    frames,
    owned,
    notes,
    cases,
    picture,
    text,
    free: reading.free,
  };
}

export interface PipelineQuestions {
  questions: PipelineQuestion[];
  units: FileUnits;
  family: FamilyVerdict;
}

/**
 * M34 P4a: a file's questions with their pictures placed (D3.1, D3.2, D6.3), tags (Q53) and
 * the answers the rules decide; no AI and no database.
 */
export async function pipelineQuestions(
  file: string,
  readers: PipelineReaders = defaultReaders,
): Promise<PipelineQuestions> {
  const units = await readers.units(file);
  const context = await readText(file, units, readers);
  const questions = buildQuestions(await readFile(context));
  return { questions, units, family: units.family };
}
