import { inkAround, pickMarked, type Raster } from '../domain/answer-marks.js';
import { bodyFontFamily, pageLines } from '../domain/lines.js';
import { fontFamily, type PageText } from '../domain/page.js';
import { parseQuestions, type ParsedQuestion } from '../domain/questions.js';
import { hasUnreadableText, repairWithOcr } from '../domain/repair.js';
import { renderPage } from '../adapters/raster.js';
import { pageCount, readByOcr, readTextLayer } from '../adapters/readers.js';

/** `text`: the PDF's text layer (OCR only where it is unreadable). `ocr`: render and OCR every page, as for a scanned file. */
export type ReadingMode = 'text' | 'ocr';

type AnswerEvidence = 'single_option' | 'pen_mark';

export interface ExtractedQuestion {
  number: number;
  page: number;
  stem: string;
  options: { letter: string; text: string }[];
  /** Null when no option is clearly marked: the question goes to review, never a guess. */
  answer: string | null;
  evidence: AnswerEvidence | null;
}

/** Text layer first; pages with unreadable glyphs get those lines from OCR instead. */
async function readHybrid(file: string): Promise<PageText[]> {
  const pages = await readTextLayer(file);
  const repaired: PageText[] = [];
  for (const page of pages) {
    repaired.push(
      hasUnreadableText(page) ? repairWithOcr(page, await readByOcr(file, page.page)) : page,
    );
  }
  return repaired;
}

async function readPages(file: string, mode: ReadingMode): Promise<PageText[]> {
  if (mode === 'text') return readHybrid(file);
  const pages: PageText[] = [];
  for (let page = 1; page <= (await pageCount(file)); page++)
    pages.push(await readByOcr(file, page));
  return pages;
}

/** Printed words on a page (the body font, or every OCR word): their ink is not a pen mark. */
const printedBoxes = (page: PageText | undefined, family: string | null) =>
  (page?.words ?? [])
    .filter((word) => !family || !word.font || fontFamily(word.font) === family)
    .map((word) => word.box);

type Answer = Pick<ExtractedQuestion, 'answer' | 'evidence'>;
const UNDECIDED: Answer = { answer: null, evidence: null };

/**
 * Answers decided without measuring ink: a letter OCR saw circled, or a lone typed option (text
 * layer only: OCR may have lost the others). `null` means the ink has to be measured.
 */
function answerWithoutInk(question: ParsedQuestion, mode: ReadingMode): Answer | null {
  const circled = question.options.filter((option) => option.circledGlyph);
  if (circled.length === 1 && circled[0])
    return { answer: circled[0].letter, evidence: 'pen_mark' };
  if (circled.length > 1 || (mode === 'ocr' && question.maybeLostOption)) return UNDECIDED;
  const [only] = question.options;
  if (question.options.length !== 1 || !only) return null;
  return mode === 'text' ? { answer: only.letter, evidence: 'single_option' } : UNDECIDED;
}

/** The answer only from what is certain; otherwise undecided (a review item, never a guess). */
async function answerOf(
  question: ParsedQuestion,
  mode: ReadingMode,
  inkOf: (option: ParsedQuestion['options'][number]) => Promise<number>,
): Promise<Answer> {
  const certain = answerWithoutInk(question, mode);
  if (certain) return certain;
  const scores = [];
  for (const option of question.options)
    scores.push({ letter: option.letter, ink: await inkOf(option) });
  const marked = pickMarked(scores);
  return marked ? { answer: marked.letter, evidence: 'pen_mark' } : UNDECIDED;
}

/** Rules-first extraction (M3.3): questions, options and pen-marked answers, with page numbers. */
export async function extractQuestions(
  file: string,
  mode: ReadingMode,
): Promise<ExtractedQuestion[]> {
  const pages = await readPages(file, mode);
  const family = mode === 'text' ? bodyFontFamily(pages) : null;
  const questions = parseQuestions(pages.flatMap((page) => pageLines(page, family)));
  const rasters = new Map<number, Promise<Raster>>();
  const raster = (page: number) => {
    if (!rasters.has(page)) rasters.set(page, renderPage(file, page));
    return rasters.get(page) as Promise<Raster>;
  };
  // Measured on the option's own page; the printed letter is masked: only added ink counts.
  const inkOf = async (option: ParsedQuestion['options'][number]) =>
    inkAround(
      await raster(option.page),
      option.letterBox,
      printedBoxes(pages[option.page - 1], family),
    );
  const extracted: ExtractedQuestion[] = [];
  for (const question of questions) {
    const options = question.options.map(({ letter, text }) => ({ letter, text }));
    const { number, page, stem } = question;
    extracted.push({ number, page, stem, options, ...(await answerOf(question, mode, inkOf)) });
  }
  return extracted;
}
