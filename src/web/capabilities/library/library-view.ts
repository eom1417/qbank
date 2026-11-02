import type { BankResponse } from '../../../contracts/library.js';

export type BankSort = 'updated' | 'created' | 'name';

const COMPARE: Record<BankSort, (a: BankResponse, b: BankResponse) => number> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  name: (a, b) => a.name.localeCompare(b.name),
};

/**
 * Banks matching a name search (any language, case-insensitive), in the chosen order (FR-03-007).
 * Sorting by study activity or weakness arrives with study data (M12).
 */
export function visibleBanks(banks: readonly BankResponse[], query: string, sort: BankSort) {
  const needle = query.trim().toLocaleLowerCase();
  return banks.filter((bank) => bank.name.toLocaleLowerCase().includes(needle)).sort(COMPARE[sort]);
}
