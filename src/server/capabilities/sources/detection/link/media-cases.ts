import { caseGroups, optionDonor, type CaseGroup } from '../../domain/pipeline/case.js';
import type { QuestionFrame } from '../../domain/pipeline/placement.js';
import type { VirtualText } from '../../domain/pipeline/virtual-text.js';
import type { DraftQuestion, LineRole, Role } from '../contract.js';
import { anchorLines, heldLines } from './media-view.js';

// M39 step 4 (media): a case or shared text read before two or more questions that refer to it
// (D6.3 rules, reused) becomes each one's case lines; a matching set shares its one option list.

/** Roles a case block may carry: read by no question, and neither page furniture nor a key. */
const CASE_ROLES = new Set<Role>(['case', 'unknown']);

/** Lines no question holds whose role leaves them free to be a case. */
function freeLines(roles: readonly LineRole[], questions: readonly DraftQuestion[]) {
  const held = new Set(questions.flatMap(heldLines));
  return new Set(
    roles.filter((r) => CASE_ROLES.has(r.role) && !held.has(r.line)).map((r) => r.line),
  );
}

/** The free lines in a group's block. */
const blockOf = (group: { from: number; to: number }, free: ReadonlySet<number>) =>
  Array.from({ length: Math.max(0, group.to - group.from) }, (_, i) => group.from + i).filter(
    (id) => free.has(id),
  );

/** Members of a matching set with no options of their own take the set's one printed list. */
function shareOptions(questions: DraftQuestion[], group: CaseGroup): Set<number> {
  const counts = questions.map((q) => q.options.length);
  const donor = optionDonor(group, counts);
  const shared = new Set<number>();
  const options = donor === null ? [] : (questions[donor]?.options ?? []);
  for (const index of group.questions) {
    const q = questions[index];
    if (!q || index === donor || options.length === 0 || q.options.length > 0) continue;
    q.options = options.map((option) => ({ ...option, lines: [...option.lines] }));
    shared.add(index);
  }
  return shared;
}

/** Lines the roles step called a case, right before the question's anchor and free. */
function caseBlockBefore(q: DraftQuestion, named: ReadonlySet<number>, free: Set<number>) {
  const block: number[] = [];
  const first = anchorLines(q)[0] ?? -1;
  for (let id = first - 1; id >= 0 && free.has(id) && named.has(id); id--) block.unshift(id);
  return block;
}

export interface CaseResult {
  groups: CaseGroup[];
  /** Questions that took a matching set's options: their letters carry no pen mark of theirs. */
  shared: Set<number>;
}

/**
 * Fills each question's case lines (kept when the link step already set them): a shared case
 * found by the D6.3 rules, else a block the roles step called a case right before it.
 */
export function attachCases(
  questions: DraftQuestion[],
  roles: readonly LineRole[],
  frames: readonly QuestionFrame[],
  view: VirtualText,
): CaseResult {
  const free = freeLines(roles, questions);
  const groups = caseGroups(frames, view, free);
  const shared = new Set<number>();
  for (const group of groups) {
    const block = blockOf(group, free);
    for (const index of group.questions) {
      const q = questions[index];
      if (q && q.caseLines.length === 0) q.caseLines = [...block];
    }
    for (const index of shareOptions(questions, group)) shared.add(index);
  }
  const named = new Set(roles.filter((r) => r.role === 'case').map((r) => r.line));
  for (const q of questions)
    if (q.caseLines.length === 0) q.caseLines = caseBlockBefore(q, named, free);
  return { groups, shared };
}
