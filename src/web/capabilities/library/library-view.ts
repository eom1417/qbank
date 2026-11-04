import type { BankResponse } from '../../../contracts/library.js';

export type BankSort = 'studied' | 'updated' | 'created' | 'name';

/** When each bank was last studied (from the session history), newest first wins. */
export type LastStudied = ReadonlyMap<string, string>;

const compare = (sort: BankSort, studied: LastStudied) => {
  const orders: Record<BankSort, (a: BankResponse, b: BankResponse) => number> = {
    // Never studied goes last; among the studied, the most recent first.
    studied: (a, b) => (studied.get(b.id) ?? '').localeCompare(studied.get(a.id) ?? ''),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return orders[sort];
};

/** The last session date of every bank a session covered. */
export function lastStudiedOf(
  sessions: readonly { createdAt: string; bankIds: readonly string[] }[],
) {
  const last = new Map<string, string>();
  for (const session of sessions)
    for (const id of session.bankIds)
      if ((last.get(id) ?? '') < session.createdAt) last.set(id, session.createdAt);
  return last;
}

/**
 * Banks matching a name search (any language, case-insensitive), in the chosen order (FR-03-007):
 * by study activity, last change, creation or name.
 */
export function visibleBanks(
  banks: readonly BankResponse[],
  query: string,
  sort: BankSort,
  studied: LastStudied = new Map(),
) {
  const needle = query.trim().toLocaleLowerCase();
  return banks
    .filter((bank) => bank.name.toLocaleLowerCase().includes(needle))
    .sort(compare(sort, studied));
}
