import type { StudyKind } from '../../../../contracts/study.js';
import type { PoolQuestion } from '../../questions/index.js';
import { stateOf, type Attempt, type QuestionState } from './mastery.js';
import { shuffled } from '../../exam-rules/index.js';
import { DEFAULT_SHARES, mixCounts, type MixGroup, type Shares } from './smart-mix.js';

/** Every graded answer of the owner's, by question, oldest first. */
export type History = ReadonlyMap<string, readonly Attempt[]>;

/**
 * The Smart Mix group of a question (FR-14-003…005): never answered is new; weak, or wrong last
 * time, is weak; answered before and due again is due. Others are not drawn by a mix.
 */
export function groupOf(state: QuestionState): MixGroup | null {
  if (state.attempts === 0) return 'new';
  if (state.level === 'weak' || state.lastCorrect === false) return 'weak';
  return state.isDue ? 'due' : null;
}

/** Whether a question fits the session kind (FR-12-002). Flagged is filtered in the pool. */
function fitsKind(kind: StudyKind, state: QuestionState): boolean {
  if (kind === 'new') return state.attempts === 0;
  if (kind === 'wrong') return state.lastCorrect === false;
  if (kind === 'weak') return groupOf(state) === 'weak';
  if (kind === 'due') return state.attempts > 0 && state.isDue;
  return true;
}

/**
 * One question per exact text (FR-14-006, FR-10-005, UAT-059): the same question kept twice in
 * a bank is never asked twice in one session. Similar but different questions all stay.
 */
function oncePerText(pool: readonly PoolQuestion[]): PoolQuestion[] {
  const seen = new Set<string>();
  return pool.filter((question) => {
    if (seen.has(question.exactKey)) return false;
    seen.add(question.exactKey);
    return true;
  });
}

const stateIn = (history: History, id: string, now: Date) => stateOf(history.get(id) ?? [], now);

/** The questions a session of this kind may draw from, each text once. */
export function candidatesFor(
  kind: StudyKind,
  pool: readonly PoolQuestion[],
  history: History,
  now: Date,
) {
  return oncePerText(pool.filter((q) => fitsKind(kind, stateIn(history, q.id, now))));
}

/** The pool sorted into the three Smart Mix groups, each text once. */
export function mixGroups(pool: readonly PoolQuestion[], history: History, now: Date) {
  const groups: Record<MixGroup, PoolQuestion[]> = { new: [], weak: [], due: [] };
  for (const q of oncePerText(pool)) {
    const group = groupOf(stateIn(history, q.id, now));
    if (group) groups[group].push(q);
  }
  return groups;
}

interface MixPick {
  question: PoolQuestion;
  reason: MixGroup;
}

/**
 * A Smart Mix (FR-14-001, FR-14-002): the counts by the shares, any shortfall moved by the
 * declared rule, each question with why it was chosen (FR-14-008), in a random order.
 */
export function smartMix(
  groups: Record<MixGroup, PoolQuestion[]>,
  size: number,
  random: () => number,
  shares: Shares = DEFAULT_SHARES,
) {
  const available = { new: groups.new.length, weak: groups.weak.length, due: groups.due.length };
  const counts = mixCounts(size, available, shares);
  const picks: MixPick[] = (['new', 'weak', 'due'] as const).flatMap((reason) =>
    shuffled(groups[reason], random)
      .slice(0, counts[reason])
      .map((question) => ({ question, reason })),
  );
  return { picks: shuffled(picks, random), counts };
}
