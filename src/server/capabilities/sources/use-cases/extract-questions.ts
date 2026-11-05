import {
  decideAnswer,
  type AnswerConflict,
  type AnswerEvidence,
  type AnswerInputs,
} from '../domain/answer-decision.js';
import { attachKeys, type QuestionKeys } from '../domain/answer-keys.js';
import { inkAround, pickMarked, type Raster } from '../domain/answer-marks.js';
import { asksForSeveral } from '../domain/key-lines.js';
import { separateKeys } from '../domain/key-pass.js';
import { bodyFontFamilies, pageLines } from '../domain/lines.js';
import { dropRunningLines } from '../domain/running-lines.js';
import { fontFamily, type PageText } from '../domain/page.js';
import { parseQuestions, type ParsedQuestion, type PlacedFigure } from '../domain/questions.js';
import { renderPage } from '../adapters/raster.js';

/** `text`: the PDF's text layer (OCR only where it is unreadable). `ocr`: render and OCR every page, as for a scanned file. */
export type ReadingMode = 'text' | 'ocr';

export interface ExtractedQuestion {
  number: number;
  page: number;
  stem: string;
  /** A question with no options is an essay question (FR-05-010); it has no answer key here. */
  kind: 'mcq' | 'essay';
  /** `letter` is positional (A, B, C…); `label` is what the page printed (A, ب, 3). */
  options: { letter: string; label: string; text: string }[];
  /** Null when nothing in the source decides it: the question goes to review, never a guess. */
  answer: string | null;
  /** Every right option; several only for a multiple-select question (FR-07-008). */
  answers: string[];
  /** `ai_read` and `ai_mark` come only from the user's AI reading the page, never from the rules. */
  evidence: AnswerEvidence | null;
  /** Key, pen mark and explanation disagree: held for review (FR-07-005). */
  conflicts: AnswerConflict[];
  /** The stem asks for several answers ("select two", DEC-05). */
  multiSelect: boolean;
  /** The author's own explanation, kept apart from anything generated (FR-07-009). */
  explanation: string | null;
  /** Where its lines are on each page, to link figures by position (M5.2). */
  spans: ParsedQuestion['spans'];
}

/** Printed words on a page (the body font, or every OCR word): their ink is not a pen mark. */
const printedBoxes = (page: PageText | undefined, body: ReadonlySet<string> | null) =>
  (page?.words ?? [])
    .filter((word) => !body || !word.font || body.has(fontFamily(word.font)))
    .map((word) => word.box);

type Answer = AnswerInputs['marked'];
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
/** Page renders kept at once: about 1 MB each, so a 1500-page book never holds them all (M17.5). */
const RASTERS_KEPT = 4;

/**
 * Renders a page once while it is in use: the few most recent stay, older ones are rendered
 * again if a later step needs them.
 */
export function rasterCache(file: string, render = renderPage) {
  const rasters = new Map<number, Promise<Raster>>();
  return (page: number) => {
    const kept = rasters.get(page) ?? render(file, page);
    rasters.delete(page);
    rasters.set(page, kept);
    for (const oldest of rasters.keys()) {
      if (RASTERS_KEPT >= rasters.size) break;
      rasters.delete(oldest);
    }
    return kept;
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
  const separated = separateKeys(dropRunningLines(lines, heights));
  const questions = parseQuestions(separated.lines, figures);
  const keys = attachKeys(questions, separated);
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
  for (const [index, question] of questions.entries()) {
    const essay = question.options.length === 0;
    const marked = essay
      ? UNDECIDED
      : await answerOf(question, modeOf(byNumber.get(question.page)), inkOf);
    extracted.push(assemble(question, marked, keys[index]));
  }
  return extracted;
}

/** One question with its answer decided from its key, marks and explanation. */
function assemble(
  question: ParsedQuestion,
  marked: Answer,
  keys: QuestionKeys | undefined,
): ExtractedQuestion {
  const options = question.options.map(({ letter, label, text }) => ({ letter, label, text }));
  const { number, page, stem, spans } = question;
  const kind = options.length === 0 ? 'essay' : 'mcq';
  const explanation = keys?.explanation ?? null;
  const decision =
    kind === 'essay'
      ? { answers: [], evidence: null, conflicts: [] }
      : decideAnswer({
          letters: options.map((o) => o.letter),
          marked,
          key: keys?.key ?? null,
          explanation,
        });
  return {
    number,
    page,
    stem,
    kind,
    options,
    spans,
    answer: decision.answers[0] ?? null,
    answers: decision.answers,
    evidence: decision.evidence,
    conflicts: decision.conflicts,
    multiSelect: asksForSeveral(stem),
    explanation,
  };
}
