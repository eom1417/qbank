/** The groups of a Smart Mix session (FR-14-001): never answered, weak or wrong, due again. */
export type MixGroup = 'new' | 'weak' | 'due';
export type Shares = Record<MixGroup, number>;

export const DEFAULT_SHARES: Shares = { new: 50, weak: 30, due: 20 };
const GROUPS: MixGroup[] = ['new', 'weak', 'due'];

/** Whole-number quotas for the shares, the rounding remainder going to the largest shares. */
function quotasOf(size: number, shares: Shares): Shares {
  const total = GROUPS.reduce((sum, g) => sum + shares[g], 0);
  const exact = GROUPS.map((g) => ({ g, value: (size * shares[g]) / total }));
  const quotas = Object.fromEntries(exact.map(({ g, value }) => [g, Math.floor(value)])) as Shares;
  let left = size - GROUPS.reduce((sum, g) => sum + quotas[g], 0);
  for (const { g } of [...exact].sort((a, b) => (b.value % 1) - (a.value % 1))) {
    if (left === 0) break;
    quotas[g] += 1;
    left -= 1;
  }
  return quotas;
}

/** Gives what a short group cannot take to the groups that still have questions, by share. */
function redistribute(counts: Shares, available: Shares, shares: Shares, missing: number): number {
  const open = GROUPS.filter((g) => available[g] > counts[g] && shares[g] > 0);
  const weight = open.reduce((sum, g) => sum + shares[g], 0);
  if (open.length === 0 || weight === 0) return missing;
  let left = missing;
  for (const g of open) {
    const give = Math.min(
      available[g] - counts[g],
      Math.ceil((missing * shares[g]) / weight),
      left,
    );
    counts[g] += give;
    left -= give;
  }
  return left;
}

/**
 * How many of each group a session takes (FR-14-001, FR-14-002): the shares when every group
 * has enough; otherwise the shortfall moves to the other groups in proportion to their shares,
 * until the session is full or nothing is left. Groups with no share stay empty.
 */
export function mixCounts(
  size: number,
  available: Shares,
  shares: Shares = DEFAULT_SHARES,
): Shares {
  const quotas = quotasOf(size, shares);
  const counts = Object.fromEntries(
    GROUPS.map((g) => [g, Math.min(quotas[g], available[g])]),
  ) as Shares;
  let missing = size - GROUPS.reduce((sum, g) => sum + counts[g], 0);
  while (missing > 0) {
    const left = redistribute(counts, available, shares, missing);
    if (left === missing) break;
    missing = left;
  }
  return counts;
}
