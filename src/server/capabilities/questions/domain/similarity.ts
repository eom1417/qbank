/** What duplicate detection reads of a question: its text, options and answer. */
export interface ComparableQuestion {
  id: string;
  stem: string;
  options: readonly { letter: string; text: string }[];
}

/**
 * Words that can turn the right answer around when only they differ (FR-10-002): "except",
 * "not", "least"… in English and Arabic. Numbers are compared on their own.
 */
const CRITICAL = new Set([
  'except',
  'not',
  'no',
  'never',
  'always',
  'least',
  'most',
  'all',
  'none',
  'true',
  'false',
  'correct',
  'incorrect',
  'best',
  'worst',
  'first',
  'last',
  'increase',
  'increased',
  'decrease',
  'decreased',
  'high',
  'low',
  'more',
  'less',
  'إلا',
  'الا',
  'ليس',
  'ليست',
  'لا',
  'عدا',
  'باستثناء',
  'غير',
  'أكثر',
  'أقل',
  'الصحيح',
  'الخطأ',
  'خطأ',
  'صحيح',
]);

/** Similar enough to show the owner, never to merge on its own. */
export const SIMILAR_AT = 0.8;

/** Letters and digits only, lower case, one space between words (any script). */
const normalized = (text: string) =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}.]+/gu, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The words of the stem and the options, as a set. */
export function wordsOf(question: ComparableQuestion): Set<string> {
  const text = [question.stem, ...question.options.map((o) => o.text)].join(' ');
  return new Set(normalized(text).split(' ').filter(Boolean));
}

/**
 * The same question in practice (FR-10-001): the same stem and the same set of option texts,
 * in any order and with any spacing or punctuation.
 */
export function exactKey(question: ComparableQuestion): string {
  const options = question.options.map((o) => normalized(o.text)).sort();
  return [normalized(question.stem), ...options].join('\u0000');
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 1 : shared / union;
}

const isNumber = (word: string) => /\d/.test(word);

/** The words only one of the two has that can change the answer: critical words and numbers. */
export function criticalDifferences(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  const onlyOne = [...a].filter((w) => !b.has(w)).concat([...b].filter((w) => !a.has(w)));
  return [...new Set(onlyOne.filter((w) => CRITICAL.has(w) || isNumber(w)))].sort();
}
