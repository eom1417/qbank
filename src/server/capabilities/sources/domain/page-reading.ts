import { z } from 'zod';
import { area, intersect, type MediaRegion } from './media-regions.js';
import type { Box, PageText } from './page.js';

/**
 * Reading a whole page with the user's own AI (for scans and layouts the rules cannot read):
 * questions, options, the key and explanation printed on the page, and where its pictures are.
 * The reply is untrusted. Every question it yields waits for the owner's review (`ai_read`).
 */
export const PAGE_READING_PROMPT = [
  'You transcribe exam questions from one page image of a book the user owns.',
  'Copy text exactly as printed, in its own language. Never translate, fix, summarise or invent.',
  'For each question: its printed number, the stem, and every option with its printed label (A, B, ب, 1…).',
  'answers: the labels of the right options, ONLY when the page itself shows them (an answer key, a mark, or a printed "Answer:"). Otherwise [].',
  'explanation: the explanation ONLY when it is printed on the page, copied exactly. Otherwise null.',
  'figures: each picture or table that belongs to the question, as a box in fractions of the page (x, y from the top-left; width, height), 0 to 1.',
  'A question cut off at the page edge is still returned with what is visible. A page with no questions returns {"questions": []}.',
].join('\n');

const Fraction = z.number().min(0).max(1);

export const PageReply = z.object({
  questions: z
    .array(
      z.object({
        number: z.number().int().min(1).max(100_000),
        stem: z.string().trim().min(1).max(8000),
        options: z
          .array(
            z.object({
              label: z.string().trim().min(1).max(8),
              text: z.string().trim().min(1).max(2000),
            }),
          )
          .max(12),
        answers: z.array(z.string().trim().max(8)).max(12),
        explanation: z.string().trim().max(8000).nullable(),
        figures: z
          .array(
            z.object({
              kind: z.enum(['figure', 'table']),
              x: Fraction,
              y: Fraction,
              width: Fraction,
              height: Fraction,
            }),
          )
          .max(6),
      }),
    )
    .max(80),
});
export type PageReply = z.infer<typeof PageReply>;
export type ReadQuestion = PageReply['questions'][number];

/** A box smaller than this share of the page on either side is noise, not a picture. */
const MIN_SIDE = 0.03;
const LETTERS = 'ABCDEFGHIJKL';

/** The page's words as a spelling hint, when they are in reading order (not visual RTL order). */
export function textHint(page: PageText): string | null {
  if (page.visual || page.words.length === 0) return null;
  return page.words
    .map((word) => word.text)
    .join(' ')
    .slice(0, 12_000);
}

/** Options get positional letters; a right answer counts only when it names a real option. */
export function optionsAndKey(read: ReadQuestion) {
  const options = read.options.map((option, index) => ({
    letter: LETTERS[index] ?? String(index + 1),
    label: option.label,
    text: option.text,
  }));
  const byLabel = new Map(options.map((option) => [option.label.toLowerCase(), option.letter]));
  const answers = [
    ...new Set(read.answers.flatMap((label) => byLabel.get(label.toLowerCase()) ?? [])),
  ];
  return { options, answers };
}

/** A fractional box in PDF points, kept inside the page; null when too small to be a picture. */
export function boxOn(page: PageText, f: ReadQuestion['figures'][number]): Box | null {
  const x1 = Math.min(1, f.x + f.width);
  const y1 = Math.min(1, f.y + f.height);
  if (MIN_SIDE > x1 - f.x || MIN_SIDE > y1 - f.y) return null;
  return { x0: f.x * page.width, y0: f.y * page.height, x1: x1 * page.width, y1: y1 * page.height };
}

/** A located box must overlap a found picture this much (intersection over union) to take its edges. */
const MIN_OVERLAP = 0.3;

const overlap = (a: Box, b: Box) => {
  const shared = area(intersect(a, b));
  return shared / (area(a) + area(b) - shared || 1);
};

/**
 * The AI says roughly where a picture is; the rules know its exact edges when they found it. The
 * best-overlapping found region on the page wins (with its resolution); else the AI's box stays.
 */
export function snapToRegion(page: number, box: Box, regions: readonly MediaRegion[]) {
  let best: MediaRegion | null = null;
  for (const region of regions)
    if (
      region.page === page &&
      overlap(box, region.box) >= Math.max(MIN_OVERLAP, best ? overlap(box, best.box) : 0)
    )
      best = region;
  return best;
}
