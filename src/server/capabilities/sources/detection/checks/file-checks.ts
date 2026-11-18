import type { Doubt, DraftQuestion, LineRole } from '../contract.js';
import { allLines } from './question-lines.js';

const QUIET = new Set(['filler', 'heading', 'note', 'tag']);

const runsOf = (ids: number[]): number[][] =>
  ids.reduce<number[][]>((runs, id) => {
    const last = runs[runs.length - 1];
    if (last && id === (last[last.length - 1] ?? -2) + 1) last.push(id);
    else runs.push([id]);
    return runs;
  }, []);

/** Lines no question owns and no role explains, grouped into contiguous runs. */
export function coverageCheck(roles: LineRole[], questions: DraftQuestion[]): Doubt[] {
  const owned = new Set(questions.flatMap(allLines));
  const loose = roles
    .filter((r) => (r.role === 'unknown' || r.confidence < 0.5) && !QUIET.has(r.role))
    .map((r) => r.line)
    .filter((id) => !owned.has(id))
    .sort((a, b) => a - b);
  return runsOf(loose).map((lines) => ({
    check: 'coverage',
    question: null,
    lines,
    detail: `${lines.length} line(s) have no clear role and belong to no question.`,
  }));
}

/** A number that does not follow the one before it; a restart at 1 is a new section. */
export function numberingCheck(questions: DraftQuestion[]): Doubt[] {
  return questions.flatMap((q, index): Doubt[] => {
    const prev = questions[index - 1];
    if (!prev || q.number === prev.number + 1 || q.number === 1) return [];
    const lines = q.labelLine === null ? [] : [q.labelLine];
    return [
      {
        check: 'numbering',
        question: index,
        lines,
        detail: `Question ${q.number} follows ${prev.number}.`,
      },
    ];
  });
}

/** One key number printed twice (the same or a different answer). */
export function keyUseFile(roles: LineRole[]): Doubt[] {
  const seen = new Map<number, number[]>();
  for (const role of roles)
    for (const entry of role.entries ?? [])
      seen.set(entry.number, [...(seen.get(entry.number) ?? []), role.line]);
  return [...seen.entries()]
    .filter(([, lines]) => lines.length > 1)
    .map(([number, lines]) => ({
      check: 'key_use' as const,
      question: null,
      lines,
      detail: `Key entry ${number} is used more than once.`,
    }));
}
