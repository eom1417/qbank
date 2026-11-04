import {
  criticalDifferences,
  exactKey,
  jaccard,
  SIMILAR_AT,
  wordsOf,
  type ComparableQuestion,
} from './similarity.js';

export interface FoundPair {
  /** The earlier question. */
  a: string;
  /** The new one. */
  b: string;
  kind: 'exact' | 'similar';
  similarity: number;
  differences: string[];
}

/** A word in this share of the bank's questions says nothing about which ones are alike. */
const COMMON_SHARE = 0.3;
const MIN_BANK_FOR_COMMON = 20;

interface Indexed {
  question: ComparableQuestion;
  words: Set<string>;
  key: string;
  /** Reading order: a question is compared only with those before it. */
  order: number;
}

/** Words to questions, leaving out words that nearly every question has. */
function wordIndex(items: readonly Indexed[]) {
  const index = new Map<string, Indexed[]>();
  for (const item of items)
    for (const word of item.words) {
      const holders = index.get(word);
      if (holders) holders.push(item);
      else index.set(word, [item]);
    }
  const limit = items.length >= MIN_BANK_FOR_COMMON ? items.length * COMMON_SHARE : Infinity;
  for (const [word, holders] of index) if (holders.length > limit) index.delete(word);
  return index;
}

/** Questions before this one with the same text, or sharing a telling word with it, each once. */
function candidates(item: Indexed, index: Map<string, Indexed[]>, byKey: Map<string, Indexed[]>) {
  const found = new Set<Indexed>((byKey.get(item.key) ?? []).filter((o) => o.order < item.order));
  for (const word of item.words)
    for (const other of index.get(word) ?? []) if (other.order < item.order) found.add(other);
  return [...found];
}

function pairOf(earlier: Indexed, item: Indexed): FoundPair | null {
  if (earlier.key === item.key)
    return {
      a: earlier.question.id,
      b: item.question.id,
      kind: 'exact',
      similarity: 1,
      differences: [],
    };
  const similarity = jaccard(earlier.words, item.words);
  if (similarity < SIMILAR_AT) return null;
  const differences = criticalDifferences(earlier.words, item.words);
  return { a: earlier.question.id, b: item.question.id, kind: 'similar', similarity, differences };
}

/**
 * Pairs of the same or similar questions between new ones and the bank's earlier ones, and
 * among the new ones in their order (FR-10-001, FR-10-002). A similar pair names the critical
 * words that differ (except, not, a dose…): similarity is never a reason to merge.
 */
export function findPairs(
  earlier: readonly ComparableQuestion[],
  added: readonly ComparableQuestion[],
): FoundPair[] {
  const items = [...earlier, ...added].map((question, order): Indexed => ({
    question,
    words: wordsOf(question),
    key: exactKey(question),
    order,
  }));
  const index = wordIndex(items);
  const byKey = new Map<string, Indexed[]>();
  for (const item of items) byKey.set(item.key, [...(byKey.get(item.key) ?? []), item]);
  const pairs: FoundPair[] = [];
  for (const item of items.slice(earlier.length)) {
    for (const other of candidates(item, index, byKey)) {
      const pair = pairOf(other, item);
      if (pair) pairs.push(pair);
    }
  }
  return pairs;
}
