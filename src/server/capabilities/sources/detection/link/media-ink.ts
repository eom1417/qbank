import { pageRegions } from '../../adapters/page-regions.js';
import type { MediaRegion } from '../../domain/media-regions.js';
import { renderPage } from '../../adapters/raster.js';
import { renderColourPage } from '../../adapters/region-image.js';
import { inkAround, pickMarked, type Raster } from '../../domain/answer-marks.js';
import type { Box, PageText } from '../../domain/page.js';
import { inkNotes, noteZones, type QuestionFrame } from '../../domain/pipeline/placement.js';
import type { PipelinePicture } from '../../domain/pipeline/question.js';
import type { RgbImage } from '../../domain/pipeline/rgb-image.js';
import type { VirtualText } from '../../domain/pipeline/virtual-text.js';
import type { DraftQuestion, FileLines } from '../contract.js';
import { letterBox } from './media-view.js';

// M39 step 4 (media): what only the rendered page shows. Pen ink at an option's letter is a
// marked answer; coloured ink in a question's note zone is a handwritten note (an explanation
// picture, shown after the reveal). The rendering is a parameter: tests pass a fake page.

export interface MediaRender {
  /** Rendered figures and tables, including scans without embedded figure images. */
  regions?(file: string, pages: readonly PageText[]): Promise<MediaRegion[]>;
  /** The page in grey, for pen marks at option letters. */
  grey(file: string, page: number): Promise<Raster>;
  /** The page in colour at `dpi`, for handwritten notes. */
  colour(file: string, page: PageText, dpi: number): Promise<RgbImage>;
}

export const defaultRender: MediaRender = {
  regions: pageRegions,
  grey: (file, page) => renderPage(file, page),
  colour: renderColourPage,
};

/** Notes are looked for on a coarse colour rendering of the page. */
const NOTE_DPI = 60;

/** A page that cannot be rendered shows no ink: no mark and no note, never a failed import. */
export const orNothing = <T>(render: Promise<T>): Promise<T | null> => render.catch(() => null);

/** Printed words of each page (every line but a device's typed note) and its figures. */
export function printedBoxes(file: FileLines, view: VirtualText): Map<number, Box[]> {
  const printed = new Map<number, Box[]>();
  const add = (page: number, boxes: Box[]) =>
    printed.set(page, [...(printed.get(page) ?? []), ...boxes]);
  for (const line of file.lines)
    if (!line.deviceNote)
      add(
        line.page,
        line.words.map((word) => word.box),
      );
  for (const unit of view.units.values())
    if (unit.imageClass === 'figure') add(unit.page, [unit.box]);
  return printed;
}

export interface MarkInput {
  file: FileLines;
  printed: ReadonlyMap<number, Box[]>;
  raster: (page: number) => Promise<Raster | null>;
}

/** Ink around one option's letter, or null when the letter or its page cannot be seen. */
async function letterInk(input: MarkInput, lines: readonly number[]): Promise<number | null> {
  const box = letterBox(input.file, lines);
  const page = input.file.lines[lines[0] ?? -1]?.page ?? 0;
  const raster = box ? await input.raster(page) : null;
  return box && raster ? inkAround(raster, box, input.printed.get(page) ?? []) : null;
}

/** The option letter clearly marked in pen on the rendered page, or null. */
export async function penMark(input: MarkInput, q: DraftQuestion): Promise<string | null> {
  if (q.options.length < 2) return null;
  const scores = [];
  for (const option of q.options) {
    const ink = await letterInk(input, option.lines);
    if (ink === null) return null;
    scores.push({ letter: option.letter, ink });
  }
  return pickMarked(scores)?.letter ?? null;
}

/** A pen mark fills a question with no printed answer; one that names another is a conflict. */
export function withMark(q: DraftQuestion, letter: string | null): DraftQuestion {
  if (letter === null) return q;
  if (!q.answer) return { ...q, answer: { letters: [letter], lines: [], from: 'pen_mark' } };
  if (q.answer.letters.includes(letter)) return q;
  return { ...q, conflicts: [...q.conflicts, 'key_conflict'] };
}

export interface NoteInput {
  fileName: string;
  file: FileLines;
  frames: readonly QuestionFrame[];
  questions: readonly DraftQuestion[];
  view: VirtualText;
  printed: ReadonlyMap<number, Box[]>;
  render: MediaRender;
}

/** Ink notes found on one page, by question. */
async function pageNotes(input: NoteInput, page: PageText, zones: ReturnType<typeof noteZones>) {
  const image = await orNothing(input.render.colour(input.fileName, page, NOTE_DPI));
  if (!image) return [];
  const onPage = (id: number) => input.file.lines[id]?.page === page.page;
  const letters = input.questions
    .flatMap((q) => q.options.map((option) => option.lines))
    .filter((lines) => onPage(lines[0] ?? -1))
    .flatMap((lines) => letterBox(input.file, lines) ?? []);
  const pictures = [...input.view.units.values()]
    .filter((unit) => unit.kind === 'image' && unit.page === page.page)
    .map((unit) => unit.box);
  const printed = [...(input.printed.get(page.page) ?? []), ...pictures];
  return inkNotes({ page: page.page, image, dpi: NOTE_DPI, printed, letters }, zones);
}

/** Handwritten notes per question, as explanation pictures `ink:<page>:<n>` (n per page). */
export async function notePictures(input: NoteInput): Promise<PipelinePicture[][]> {
  const heights = new Map(input.file.pages.map((page) => [page.page, page.height]));
  const result: PipelinePicture[][] = input.frames.map(() => []);
  if (heights.size === 0) return result;
  const zones = noteZones(input.frames, heights);
  for (const page of input.file.pages) {
    if (!zones.some((zone) => zone.page === page.page)) continue;
    const notes = await pageNotes(input, page, zones);
    notes.forEach((note, n) =>
      result[note.question]?.push({
        unitId: `ink:${page.page}:${n}`,
        spot: { page: page.page, box: note.box },
        placement: 'explanation',
        optionLetter: null,
        imageClass: 'handwriting_ink',
      }),
    );
  }
  return result;
}
