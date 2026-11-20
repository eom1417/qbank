// M34 P3: a lesson card (curriculum §4) and how one sheet's reply is judged item by item.
import { z } from 'zod';

type LessonNeeds = 'text' | 'vision';

/**
 * One skill, one closed question (curriculum §2). `schema` is ONE item's answer; `check` returns
 * the error message sent back on the retry, or null when the answer passes.
 */
export interface LessonCard<I, O> {
  /** Stable lesson id, e.g. `D4.mark`. */
  id: string;
  level: number;
  needs: LessonNeeds;
  /** Raised whenever the question, cues or schema change (old cached replies stop matching). */
  version: number;
  question: string;
  yesCues: readonly string[];
  noCues: readonly string[];
  schema: z.ZodType<O>;
  check(input: I, output: O): string | null;
  /** Why an item that never passed goes to the owner's review (e.g. `elimination_unclear`). */
  reviewReason: string;
}

/** A reply for one sheet: every cell's answer, tagged with its cell number. */
export interface SheetReply<O> {
  items: ({ n: number } & O)[];
}

/** The schema of a whole sheet's reply: `{ items: [{ n, ...answer }] }`. */
export function replySchema<I, O>(card: LessonCard<I, O>): z.ZodType<SheetReply<O>> {
  const item = z.object({ n: z.number().int() }).and(card.schema);
  return z.object({ items: z.array(item) });
}

export type ItemVerdict<O> = { ok: true; output: O } | { ok: false; error: string };

/** What every item is told when the whole reply could not be read. */
export const UNREADABLE_REPLY = 'the reply was not JSON in the required shape';

function answersByNumber<O>(reply: SheetReply<O>): Map<number, ({ n: number } & O)[]> {
  const byNumber = new Map<number, ({ n: number } & O)[]>();
  for (const item of reply.items) {
    const list = byNumber.get(item.n) ?? [];
    list.push(item);
    byNumber.set(item.n, list);
  }
  return byNumber;
}

function verdictFor<I, O>(
  card: LessonCard<I, O>,
  input: I,
  answers: readonly ({ n: number } & O)[] | undefined,
): ItemVerdict<O> {
  const [first] = answers ?? [];
  if (!first) return { ok: false, error: 'no answer was given for this number' };
  if ((answers?.length ?? 0) > 1) {
    return {
      ok: false,
      error: `this number was answered ${answers?.length} times; answer it once`,
    };
  }
  const rest: Record<string, unknown> = { ...first };
  delete rest['n'];
  const parsed = card.schema.safeParse(rest);
  if (!parsed.success) return { ok: false, error: 'the answer does not match the required shape' };
  const message = card.check(input, parsed.data);
  return message === null ? { ok: true, output: parsed.data } : { ok: false, error: message };
}

/**
 * Judges a sheet's reply in cell order (cell k = `inputs[k-1]`): a missing or repeated number is
 * an error of that cell, then each answer must pass the card's own check. Numbers outside
 * 1…N belong to no cell and are ignored. A null reply fails every cell.
 */
export function judgeSheet<I, O>(
  card: LessonCard<I, O>,
  inputs: readonly I[],
  reply: SheetReply<O> | null,
): ItemVerdict<O>[] {
  if (reply === null) return inputs.map(() => ({ ok: false, error: UNREADABLE_REPLY }));
  const byNumber = answersByNumber(reply);
  return inputs.map((input, index) => verdictFor(card, input, byNumber.get(index + 1)));
}
