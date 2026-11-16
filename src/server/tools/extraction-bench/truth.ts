import { z } from 'zod';

// M34 P0: the ground truth for one source file, written from the page images and checked by
// code. It lives outside git (`.data/truth/<slug>.truth.json`); only numbers leave it.

const Page = z.number().int().positive();

/** Where an image belongs: shown with the question, with one option, or only after the reveal. */
const TruthImage = z.object({
  page: Page,
  placement: z.enum(['question', 'option', 'explanation']),
  optionLetter: z.string().length(1).nullable(),
  /** A screenshot of printed words or a table (Z5): it should become text, not stay a picture. */
  isTextPicture: z.boolean(),
  description: z.string().min(1).max(200),
});

/** A piece of the file's own explanation that the value filter keeps (level 5). */
const KeptPiece = z.object({
  page: Page,
  kind: z.enum(['text', 'table', 'image', 'handwriting_image']),
  /** Its first words, verbatim, to find it again (a summary for an image). */
  anchor: z.string().min(1).max(160),
});

/** A piece the filter drops, with the reason from the curriculum's do / do-not table. */
const DroppedPiece = z.object({
  page: Page,
  kind: z.enum([
    'highlight',
    'circle',
    'underline',
    'tick',
    'cross',
    'arrow',
    'reference',
    'logo',
    'unrelated',
    'duplicate',
    'unclear',
    'option_comment',
  ]),
  anchor: z.string().max(160),
});

const Evidence = z.enum([
  'printed_key',
  'pen_circle',
  'tick',
  'highlight',
  'underline',
  'cross_out_others',
  'single_option',
  'explanation_text',
  'none',
]);

export const TruthQuestion = z.object({
  /** Order in the file, 1…N, the identity used for scoring. */
  ordinal: z.number().int().positive(),
  /** The number the page prints, or null when it prints none. */
  printed: z.number().int().positive().nullable(),
  section: z.string().min(1),
  pages: z.array(Page).min(1),
  /** The question's own words, verbatim (Z2); a question inside an image is transcribed. */
  stem: z.string().min(1),
  stemInImage: z.boolean(),
  options: z.array(z.object({ letter: z.string().length(1), text: z.string() })),
  /** The right letters; empty when the file does not decide it. */
  answer: z.array(z.string().length(1)),
  evidence: z.array(Evidence).min(1),
  /** Two signals disagree (Q31): the question goes to review. */
  conflict: z.string().nullable(),
  caseGroup: z.string().nullable(),
  tags: z.object({ exam: z.string().nullable(), year: z.string().nullable() }),
  images: z.array(TruthImage),
  kept: z.array(KeptPiece),
  dropped: z.array(DroppedPiece),
  /** `valid` enters an exam; the rest go to review with the reason (Q32, Q54). */
  status: z.enum(['valid', 'incomplete', 'conflicting', 'single_option', 'none_of_options']),
  statusReason: z.string().nullable(),
});
export type TruthQuestion = z.infer<typeof TruthQuestion>;

export const TruthFile = z.object({
  file: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  pageCount: Page,
  family: z.enum(['annotated_notes', 'printed_key', 'exam_paper', 'exported_bank', 'scan']),
  /** The counts the file's own contents table prints (Q34). */
  headings: z.array(z.object({ section: z.string().min(1), count: z.number().int().min(0) })),
  printedTotal: z.number().int().min(0).nullable(),
  /** Pages or regions with no question content at all (frames, watermarks, covers). */
  filler: z.array(z.object({ page: Page, kind: z.string().min(1) })),
  questions: z.array(TruthQuestion),
});
export type TruthFile = z.infer<typeof TruthFile>;

/** The answer key the existing benchmark scores against (`<name>.answers.json`). */
export function toReference(truth: TruthFile) {
  return truth.questions.map((question) => {
    // Only a decided answer is scored; conflicting or incomplete questions belong in review.
    const decided = question.status === 'valid' || question.status === 'single_option';
    const answer = decided ? (question.answer[0] ?? null) : null;
    return {
      number: question.printed ?? question.ordinal,
      page: question.pages[0] ?? 0,
      options: question.options.map((option) => option.letter),
      answer,
      // The old scorer scores only answers a reader can see; every decided truth answer is one.
      evidence: answer === null ? 'none' : 'circle',
    };
  });
}
