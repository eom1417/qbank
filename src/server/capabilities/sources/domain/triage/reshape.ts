import type { Improved } from './improve.js';

export interface Reshaped {
  stem: string;
  options: { letter: string; label: string; text: string }[];
  /** Original letter → its letter now. */
  moved: Map<string, string>;
  /** Letters of the options the improvement added. */
  added: Set<string>;
  /** The letter the question's own text gives as right (a key or explanation in a scan). */
  printed: string | null;
}

/** A stable number from text: the same question always gets the same order. */
function seedOf(text: string): number {
  let seed = 2166136261;
  for (const char of text) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return seed;
}

/** Fisher–Yates with a small deterministic generator, so a rerun gives the same letters. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed || 1;
  for (let index = out.length - 1; index > 0; index--) {
    state = Math.imul(state ^ (state >>> 15), 2246822519) >>> 0;
    const pick = state % (index + 1);
    [out[index], out[pick]] = [out[pick] as T, out[index] as T];
  }
  return out;
}

/**
 * The improved question with fresh letters. With new options the order is shuffled (stably), so
 * the file's own answer, often the only option a student typed, is not always A.
 */
export function reshape(reply: Improved): Reshaped {
  const order = reply.options.some((option) => option.from === null)
    ? shuffled(reply.options, seedOf(reply.stem))
    : reply.options;
  const moved = new Map<string, string>();
  const added = new Set<string>();
  const right = reply.printedRight === null ? null : reply.options[reply.printedRight];
  let printed: string | null = null;
  const options = order.map((option, index) => {
    const letter = String.fromCharCode(65 + index);
    if (option.from) moved.set(option.from.toUpperCase(), letter);
    else added.add(letter);
    if (option === right) printed = letter;
    return { letter, label: letter, text: option.text };
  });
  return { stem: reply.stem, options, moved, added, printed };
}

/** Takes one option out (a distractor that proved fair game) and letters the rest again. */
export function withoutOption(reshaped: Reshaped, letter: string): Reshaped {
  const rest = reshaped.options.filter((option) => option.letter !== letter);
  const relettered = new Map(
    rest.map((option, index) => [option.letter, String.fromCharCode(65 + index)]),
  );
  const moved = new Map(
    [...reshaped.moved].flatMap(([from, to]) => {
      const now = relettered.get(to);
      return now ? [[from, now] as [string, string]] : [];
    }),
  );
  const added = new Set([...reshaped.added].flatMap((l) => relettered.get(l) ?? []));
  const printed = reshaped.printed ? (relettered.get(reshaped.printed) ?? null) : null;
  const options = rest.map((option) => {
    const now = relettered.get(option.letter) ?? option.letter;
    return { ...option, letter: now, label: now };
  });
  return { ...reshaped, options, moved, added, printed };
}
