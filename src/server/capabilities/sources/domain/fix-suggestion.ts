import { z } from 'zod';

/** What the user's AI may propose for one question: its text only, never its answer (DEC-04). */
export const FixSuggestion = z
  .object({
    stem: z.string().max(5000),
    options: z.array(z.object({ letter: z.string(), text: z.string().max(2000) }).strict()).max(10),
    /** Why, in one sentence. */
    reason: z.string().max(500),
    /** The words on the page that show the right reading, copied exactly. */
    evidence: z.string().max(1000),
  })
  .strict();
export type FixSuggestion = z.infer<typeof FixSuggestion>;

export const FIX_SYSTEM_PROMPT = [
  'You check one exam question that was read from a scanned or printed page.',
  'Fix only clear reading errors: misread characters, broken words, a wrong unit or number that the page shows correctly.',
  'Never change the meaning, never add facts, never reword for style, never add or remove options, never choose an answer.',
  'Copy into "evidence" the exact words from the page text that show the right reading.',
  'If nothing needs fixing, return the question unchanged.',
].join(' ');

export type FixRefusal = 'no_change' | 'changed_options' | 'padding' | 'unsupported';

interface CurrentText {
  stem: string;
  options: readonly { letter: string; text: string }[];
}

const normalized = (text: string) =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Longer than the original by more than a reading fix can explain (FR-24-005: no padding). */
const padded = (before: string, after: string) => after.length > before.length * 1.2 + 20;

/**
 * Checks a suggestion before the owner sees it: the same options, no padding, an actual
 * change, and evidence that is really on the page (FR-08-014: no unsupported inference).
 */
export function refusalOf(
  current: CurrentText,
  suggestion: FixSuggestion,
  pageText: string,
): FixRefusal | null {
  const letters = (options: readonly { letter: string }[]) => options.map((o) => o.letter).join();
  if (letters(current.options) !== letters(suggestion.options)) return 'changed_options';
  const texts = (q: CurrentText) => [q.stem, ...q.options.map((o) => o.text)];
  const before = texts(current);
  const after = texts(suggestion);
  if (before.every((text, i) => normalized(text) === normalized(after[i] ?? '')))
    return 'no_change';
  if (before.some((text, i) => padded(text, after[i] ?? ''))) return 'padding';
  const evidence = normalized(suggestion.evidence);
  return evidence !== '' && normalized(pageText).includes(evidence) ? null : 'unsupported';
}
