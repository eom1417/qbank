// M39 step 6: is an AI correction of an OCR line only a spelling fix? Close as a whole, and every
// word of it close to a word the OCR read (no new words of the model's own).

/** The most a corrected line may differ from the read one, as a share of its length. */
const LINE_DISTANCE = 0.3;
/** The most one corrected word may differ from the read word it fixes. */
const WORD_DISTANCE = 0.5;

/** Levenshtein distance, one row at a time. */
function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const swap = (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      next.push(Math.min(swap, (row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1));
    }
    row = next;
  }
  return row[b.length] ?? 0;
}

/** 0 for equal texts, 1 for nothing in common. */
const distance = (a: string, b: string) => editDistance(a, b) / Math.max(1, a.length, b.length);

const wordsOf = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean);

/** True when `corrected` fixes only the spelling (and case) of `original`. */
export function isSpellingFix(original: string, corrected: string): boolean {
  if (distance(original.trim(), corrected.trim()) > LINE_DISTANCE) return false;
  const read = wordsOf(original);
  if (Math.abs(read.length - wordsOf(corrected).length) > 1) return false;
  return wordsOf(corrected).every((word) =>
    read.some((old) => distance(old, word) <= WORD_DISTANCE),
  );
}
