import type { KeyEntry } from './key-lines.js';
import type { SeparatedLines } from './key-pass.js';
import type { Box } from './page.js';

/** What linking needs of a parsed question: its number and where its lines are. */
interface KeyedQuestion {
  number: number;
  spans: readonly { box: Box }[];
}

/** A key section and where it stands: after the question at `position` (-1: before all). */
export interface PlacedKey {
  position: number;
  entries: readonly KeyEntry[];
}

/** Splits a numbered list where its numbering starts again (a new chapter). */
function runs<T>(items: readonly T[], numberOf: (item: T) => number): T[][] {
  const result: T[][] = [];
  items.forEach((item, index) => {
    const previous = items[index - 1];
    if (!previous || numberOf(item) <= numberOf(previous)) result.push([]);
    result.at(-1)?.push(item);
  });
  return result;
}

/**
 * Answers from key sections, matched by chapter and number (FR-07-001, UAT-012): each run of
 * key numbers answers the earliest run of questions before it that has no key yet, so a key
 * after each chapter and one key at the end of the book (numbering restarting per chapter) both
 * land on the right questions. Unmatched numbers are ignored, never guessed.
 */
export function matchKeys(
  numbers: readonly number[],
  keys: readonly PlacedKey[],
): (string[] | null)[] {
  const answers: (string[] | null)[] = numbers.map(() => null);
  const indexed = numbers.map((number, index) => ({ number, index }));
  const questionRuns = runs(indexed, (q) => q.number);
  const keyed = new Set<number>();
  for (const key of keys) {
    for (const keyRun of runs(key.entries, (entry) => entry.number)) {
      const run = questionRuns.findIndex(
        (questions, i) => !keyed.has(i) && (questions.at(-1)?.index ?? Infinity) <= key.position,
      );
      if (run < 0) continue;
      keyed.add(run);
      const byNumber = new Map(keyRun.map((entry) => [entry.number, entry.letters]));
      for (const question of questionRuns[run] ?? [])
        answers[question.index] = byNumber.get(question.number) ?? null;
    }
  }
  return answers;
}

/** The key and the author's explanation each question has in the source. */
export interface QuestionKeys {
  key: string[] | null;
  /** Where the key came from: printed beside the question, or a key section. */
  keyFrom: 'inline' | 'section' | null;
  explanation: string | null;
}

/** Ties the separated keys and explanations back to the parsed questions. */
export function attachKeys(
  questions: readonly KeyedQuestion[],
  separated: Omit<SeparatedLines, 'lines'>,
): QuestionKeys[] {
  const owner = (after: { box: Box } | null) =>
    after ? questions.findLastIndex((q) => q.spans.some((span) => span.box === after.box)) : -1;
  const result: QuestionKeys[] = questions.map(() => ({
    key: null,
    keyFrom: null,
    explanation: null,
  }));
  const sections = separated.keys.map((key) => ({
    position: owner(key.after),
    entries: key.entries,
  }));
  matchKeys(
    questions.map((q) => q.number),
    sections,
  ).forEach((key, index) => {
    const slot = result[index];
    if (key && slot) Object.assign(slot, { key, keyFrom: 'section' });
  });
  for (const inline of separated.inline) {
    const slot = result[owner(inline.after)];
    if (slot) Object.assign(slot, { key: inline.letters, keyFrom: 'inline' });
  }
  for (const explanation of separated.explanations) {
    const slot = result[owner(explanation.after)];
    if (slot)
      slot.explanation = slot.explanation
        ? `${slot.explanation} ${explanation.text}`
        : explanation.text;
  }
  return result;
}
