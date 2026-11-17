import { z } from 'zod';

/** Option letters the annotated notes use. */
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type Letter = (typeof LETTERS)[number];

/** One reply line: an item number shown to the model and the marked letter, or null. */
const ReplyLine = z.object({
  item: z.number(),
  letter: z.enum(LETTERS).nullable(),
});

export const MarkReply = z.object({ answers: z.array(ReplyLine) });
export type MarkReply = z.infer<typeof MarkReply>;

export const MARK_SYSTEM =
  'You read scanned pages of medical multiple-choice notes. A student marked answers by hand ' +
  '(red circles, ticks, highlights, underlines) or the page prints "Correct answer: X". For each ' +
  'item number you are asked about, say which option letter is marked as the answer by the ' +
  'annotator, or null if none is marked. Reply with JSON only: ' +
  '{"answers":[{"item":<number>,"letter":"A"|"B"|"C"|"D"|"E"|"F"|null}]}.';

/** The user instruction for a set of item numbers, worded per format. */
export function markPrompt(format: 'FULL' | 'CROP' | 'SHEET', items: readonly number[]): string {
  const list = items.join(', ');
  if (format === 'FULL') return `Questions on this page, by their printed number Q<n>: ${list}.`;
  if (format === 'SHEET')
    return `The image holds numbered panels; answer for panel numbers: ${list}.`;
  return `The image is one question; answer it as item ${list}.`;
}

/** Item number to letter; the first reply wins when a number repeats. */
function replyMap(reply: MarkReply): Map<number, Letter | null> {
  const map = new Map<number, Letter | null>();
  for (const line of reply.answers) {
    if (!map.has(line.item)) map.set(line.item, line.letter);
  }
  return map;
}

export interface Expected {
  item: number;
  letter: Letter | null;
}

/** Correct count against the key; an item missing from the reply counts as wrong. */
export function scoreReply(reply: MarkReply | null, expected: readonly Expected[]): number {
  if (!reply) return 0;
  const map = replyMap(reply);
  return expected.filter((e) => map.has(e.item) && map.get(e.item) === e.letter).length;
}
