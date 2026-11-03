import { latinDigits } from './bidi.js';

/** The label systems options are numbered in (FR-05-005): A B C, a b c, أ ب ج, 1 2 3. */
export type OptionSystem = 'latin' | 'lower' | 'arabic' | 'digits';

const SEQUENCES: Record<OptionSystem, readonly string[]> = {
  latin: [...'ABCDEFGHIJ'],
  lower: [...'abcdefghij'],
  arabic: ['أ', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ي'],
  digits: [...'123456789'],
};

// Arabic letters as typed or as some fonts write them ("هـ", "ا" for "أ").
const ARABIC_ALIASES: Record<string, string> = { هـ: 'ه', ا: 'أ', إ: 'أ', آ: 'أ' };

export interface OptionLabel {
  system: OptionSystem;
  /** Position in its system: 0 for A, a, أ or 1. */
  index: number;
  label: string;
  text: string;
}

const systemOfLetter = (letter: string): OptionSystem =>
  letter === letter.toUpperCase() ? 'latin' : 'lower';

/** Option patterns in the order they are tried: [regex, system of the matched label]. */
const OPTION_PATTERNS: readonly [RegExp, (label: string) => OptionSystem][] = [
  [/^\(?([A-Ja-j])\s?[.)]\s*(.*)$/, systemOfLetter],
  [/^\(?(هـ|[أاإآبجدهوزحطي])\s?[.)\-–:]\s*(.*)$/, () => 'arabic'],
  // Digits only with a bracket or a dash: "1." would be read as a question number.
  [/^\(?(\d)\s?[)\-–]\s*(.*)$/, () => 'digits'],
];

/** Reads an option label at the start of a line, in whichever system it is written. */
export function optionLabel(line: string): OptionLabel | null {
  const text = latinDigits(line);
  for (const [pattern, systemOf] of OPTION_PATTERNS) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const system = systemOf(match[1]);
    const label = system === 'arabic' ? (ARABIC_ALIASES[match[1]] ?? match[1]) : match[1];
    const index = SEQUENCES[system].indexOf(label);
    return index === -1 ? null : { system, index, label: match[1], text: match[2] ?? '' };
  }
  return null;
}

/** The answer letter of the option at `index` (A, B, C…), whatever system printed it. */
export const answerLetter = (index: number): string => String.fromCharCode(65 + index);

// "Q12)", "س12)", "سؤال 12:", "Question 12." are always questions…
const PREFIXED = /^(?:Q|Question|س|سؤال)\s?(\d{1,4})\s?[).:\-–]?\s*(.*)$/i;
// …"12." or "12)" only when the numbering follows on (a numbered list is not a question).
const BARE = /^(\d{1,4})\s?[.)\-–]\s+(.*)$/;

export interface QuestionLabel {
  number: number;
  text: string;
  prefixed: boolean;
}

export function questionLabel(line: string): QuestionLabel | null {
  const text = latinDigits(line);
  const prefixed = PREFIXED.exec(text);
  if (prefixed?.[1])
    return { number: Number(prefixed[1]), text: prefixed[2] ?? '', prefixed: true };
  const bare = BARE.exec(text);
  return bare?.[1] ? { number: Number(bare[1]), text: bare[2] ?? '', prefixed: false } : null;
}
