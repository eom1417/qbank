import { inkAround, pickMarked, type Raster } from '../domain/answer-marks.js';
import { bodyFontFamilies, pageLines } from '../domain/lines.js';
import { dropRunningLines } from '../domain/running-lines.js';
import { fontFamily, type PageText } from '../domain/page.js';
import { parseQuestions, type ParsedQuestion, type PlacedFigure } from '../domain/questions.js';
import { renderPage } from '../adapters/raster.js';

/** `text`: the PDF's text layer (OCR only where it is unreadable). `ocr`: render and OCR every page, as for a scanned file. */
export type ReadingMode = 'text' | 'ocr';

/** `ai_suggested` comes only from the user's AI (suggest-marks), never from the rules. */
type AnswerEvidence = 'single_option' | 'pen_mark' | 'ai_suggested';

export interface ExtractedQuestion {
  number: number;
  page: number;
  stem: string;
  /** A question with no options is an essay question (FR-05-010); it has no answer key here. */
  kind: 'mcq' | 'essay';
  /** `letter` is positional (A, B, C…); `label` is what the page printed (A, ب, 3). */
  options: { letter: string; label: string; text: string }[];
  /** Null when no option is clearly marked: the question goes to review, never a guess. */
  answer: string | null;
  evidence: AnswerEvidence | null;
  /** Where its lines are on each page, to link figures by position (M5.2). */
  spans: ParsedQuestion['spans'];
}

/** Printed words on a page (the body font, or every OCR word): their ink is not a pen mark. */
const printedBoxes = (page: PageText | undefined, body: ReadonlySet<string> | null) =>
  (page?.words ?? [])
    .filter((word) => !body || !word.font || body.has(fontFamily(word.font)))
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

/** OCR pages (no text layer) follow the stricter rules: a lone option is not taken as the key. */
const modeOf = (page: PageText | undefined): ReadingMode => (page?.visual ? 'text' : 'ocr');

/** Page images rendered once per file, shared by mark and figure detection. */
export function rasterCache(file: string) {
  const rasters = new Map<number, Promise<Raster>>();
  return (page: number) => {
    if (!rasters.has(page)) rasters.set(page, renderPage(file, page));
    return rasters.get(page) as Promise<Raster>;
  };
}

/**
 * Questions, options and pen-marked answers from pages already read (any page range; text
 * layer and OCR pages may be mixed). Running headers and footers are removed first.
 */
export async function questionsFromPages(
  file: string,
  pages: readonly PageText[],
  raster = rasterCache(file),
  figures: readonly PlacedFigure[] = [],
): Promise<ExtractedQuestion[]> {
  const byNumber = new Map(pages.map((page) => [page.page, page]));
  const body = bodyFontFamilies(pages.filter((page) => page.visual));
  const lines = pages.flatMap((page) => pageLines(page, page.visual ? body : null));
  const heights = new Map(pages.map((page) => [page.page, page.height]));
  const questions = parseQuestions(dropRunningLines(lines, heights), figures);
  // Measured on the option's own page; the printed letter is masked: only added ink counts.
  const inkOf = async (option: ParsedQuestion['options'][number]) => {
    const page = byNumber.get(option.page);
    return inkAround(
      await raster(option.page),
      option.letterBox,
      printedBoxes(page, page?.visual ? body : null),
    );
  };
  const extracted: ExtractedQuestion[] = [];
  for (const question of questions) {
    const options = question.options.map(({ letter, label, text }) => ({ letter, label, text }));
    const { number, page, stem, spans } = question;
    const kind = options.length === 0 ? 'essay' : 'mcq';
    const answer =
      kind === 'essay' ? UNDECIDED : await answerOf(question, modeOf(byNumber.get(page)), inkOf);
    extracted.push({ number, page, stem, kind, options, spans, ...answer });
  }
  return extracted;
}
