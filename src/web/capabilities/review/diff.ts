import type { DiffSegment } from '../../design-system/index.js';

const MAX_WORDS = 2000;

/** Splits text into words and the spaces between them, so a diff keeps the original spacing. */
const tokens = (text: string) => text.split(/(\s+)/).filter((token) => token !== '');

/** Longest common subsequence table, from the end, for a word diff. */
function lcsTable(a: readonly string[], b: readonly string[]): number[][] {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    const row = table[i] as number[];
    const below = table[i + 1] as number[];
    for (let j = b.length - 1; j >= 0; j--)
      row[j] = a[i] === b[j] ? (below[j + 1] ?? 0) + 1 : Math.max(below[j] ?? 0, row[j + 1] ?? 0);
  }
  return table;
}

function push(segments: DiffSegment[], kind: DiffSegment['kind'], text: string) {
  const last = segments.at(-1);
  if (last?.kind === kind) last.text += text;
  else segments.push({ kind, text });
}

const cell = (table: number[][], i: number, j: number) => table[i]?.[j] ?? 0;

/** The next step of the walk through the table: keep, add from `b`, or remove from `a`. */
function nextKind(
  table: number[][],
  a: readonly string[],
  b: readonly string[],
  i: number,
  j: number,
) {
  if (i < a.length && j < b.length && a[i] === b[j]) return 'same';
  if (i >= a.length) return 'added';
  if (j >= b.length) return 'removed';
  return cell(table, i, j + 1) > cell(table, i + 1, j) ? 'added' : 'removed';
}

/** Too long to compare word by word: the whole text before, then the whole text after. */
const wholeChange = (before: string, after: string): DiffSegment[] => [
  { kind: 'removed', text: before },
  { kind: 'added', text: after },
];

/** Walks the table from the start, collecting runs of kept, added and removed words. */
function walk(a: readonly string[], b: readonly string[]): DiffSegment[] {
  const table = lcsTable(a, b);
  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const kind = nextKind(table, a, b, i, j);
    if (kind === 'same') j++;
    push(segments, kind, kind === 'added' ? String(b[j++]) : String(a[i++]));
  }
  return segments;
}

/**
 * What changed between two texts, word by word (UAT-033, FR-09-005): kept, removed and added
 * runs. Very long texts are compared as a whole.
 */
export function wordDiff(before: string, after: string): DiffSegment[] {
  if (before === after) return before === '' ? [] : [{ kind: 'same', text: after }];
  const a = tokens(before);
  const b = tokens(after);
  return a.length > MAX_WORDS || b.length > MAX_WORDS ? wholeChange(before, after) : walk(a, b);
}
