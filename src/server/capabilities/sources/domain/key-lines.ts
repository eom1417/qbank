import { latinDigits } from './bidi.js';

/** Option letters as printed (A–E, a–e, أ–هـ), as positional answer letters A, B, C… */
const LETTERS: Record<string, string> = {
  أ: 'A',
  ا: 'A',
  ب: 'B',
  ج: 'C',
  د: 'D',
  ه: 'E',
  هـ: 'E',
  و: 'F',
};

/** One answer as a key prints it ("B", "b", "ب") as a letter A, B, C…; null when it is not one. */
export function keyLetter(printed: string): string | null {
  const text = printed.trim();
  if (/^[A-Fa-f]$/.test(text)) return text.toUpperCase();
  return LETTERS[text] ?? null;
}

const LETTER = '[A-Fa-f]|هـ|[أابجدهو]';
const LETTER_LIST = `(?:${LETTER})(?:\\s*(?:,|،|and|&|و)\\s*(?:${LETTER}))*`;

// "Answer: B", "Correct answer: D", "Ans. C", "Key: B, D", "الإجابة: ب", "الجواب الصحيح: ج".
const INLINE = new RegExp(
  `^(?:(?:the\\s+)?(?:correct\\s+)?(?:answer|ans\\.?|key)|الإجابة(?:\\s+الصحيحة)?|الجواب(?:\\s+الصحيح)?)\\s*(?:is|هي|هو)?\\s*[:：\\-–]?\\s*\\(?(${LETTER_LIST})\\)?\\s*\\.?$`,
  'i',
);

const lettersIn = (list: string) =>
  list
    .split(/\s*(?:,|،|and|&|\s)\s*/i)
    .map((part) => (part === 'و' ? null : keyLetter(part)))
    .filter((letter): letter is string => letter !== null);

/** The answer printed right after a question (FR-07-001); several letters for multiple-select. */
export function inlineAnswer(line: string): string[] | null {
  const match = INLINE.exec(line.trim());
  return match?.[1] ? lettersIn(match[1]) : null;
}

// "Answers", "Answer key", "Key to chapter 3", "مفتاح الإجابات", "الإجابات", "الإجابات الصحيحة".
const HEADING =
  /^(?:(?:the\s+)?answers?(?:\s+key)?|answer\s+keys?|key\s+to\s+.*|key|مفتاح\s+الإجاب(?:ة|ات)|الإجابات(?:\s+الصحيحة)?|الأجوبة)\s*:?$/i;

export const isKeyHeading = (line: string) => HEADING.test(line.trim());

export interface KeyEntry {
  number: number;
  letters: string[];
}

const ENTRY = new RegExp(`(\\d{1,4})\\s*[.):\\-–]?\\s*(${LETTER_LIST})(?![\\p{L}])`, 'gu');

/**
 * A line made only of key entries ("1. A  2. C  3) B", "12: B, D", "١- ب"): its entries, or
 * null when anything else is on the line (a question, a sentence).
 */
export function keyEntries(line: string): KeyEntry[] | null {
  const text = latinDigits(line).trim();
  if (!text) return null;
  const entries: KeyEntry[] = [];
  const rest = text.replace(ENTRY, (_, number: string, list: string) => {
    entries.push({ number: Number(number), letters: lettersIn(list) });
    return ' ';
  });
  return entries.length > 0 && /^[\s|;،,]*$/.test(rest) ? entries : null;
}

// "Explanation:", "Rationale -", "Discussion", "الشرح:", "التعليل:", "التوضيح".
// The word must be followed by a colon or dash, or stand alone: "explanation for her cycles?"
// is part of a stem.
const EXPLANATION =
  /^(?:explanation|rationale|discussion|الشرح|التعليل|التوضيح)\s*(?:[:：\-–]\s*(.*)|$)/i;

/** The start of the author's explanation (FR-07-009): its first text, or null. */
export function explanationStart(line: string): string | null {
  const match = EXPLANATION.exec(line.trim());
  return match ? (match[1] ?? '') : null;
}

// "The correct answer is C", "Answer is (B)", "B is correct", "الإجابة الصحيحة هي ج".
const CLAIM = new RegExp(
  `(?:correct\\s+answer\\s+is|answer\\s+is|الإجابة\\s+الصحيحة\\s+(?:هي\\s+)?)\\s*\\(?(${LETTER})\\)?(?![\\p{L}])|(?:^|\\s)\\(?(${LETTER})\\)?\\s+is\\s+(?:the\\s+)?correct`,
  'iu',
);

/** The letter an explanation says is right, if it names one (FR-07-005). */
export function explanationClaim(text: string): string | null {
  const match = CLAIM.exec(text);
  const printed = match?.[1] ?? match?.[2];
  return printed ? keyLetter(printed) : null;
}

// "Select two", "Choose all that apply", "more than one answer", "اختر إجابتين", "كل ما ينطبق".
const MULTI =
  /\b(?:select|choose|pick)\s+(?:two|three|four|2|3|4|all)\b|all\s+that\s+apply|more\s+than\s+one\s+(?:answer|option)|اختر\s+(?:إجابتين|اثنتين|ثلاث)|كل\s+ما\s+ينطبق|أكثر\s+من\s+إجابة/i;

/** The stem asks for several answers (FR-07-008, DEC-05). */
export const asksForSeveral = (stem: string) => MULTI.test(stem);
