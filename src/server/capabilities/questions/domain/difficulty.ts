/** Graded answers needed before results say anything about a question's difficulty. */
const MIN_ATTEMPTS = 5;

/**
 * Difficulty from the owner's own results (FR-11-005): 1 (always right) to 5 (always wrong).
 * Null with too few answers. A difficulty the owner set by hand is never replaced by this.
 */
export function inferredDifficulty(correct: number, total: number): number | null {
  if (MIN_ATTEMPTS > total) return null;
  return 5 - Math.round((correct / total) * 4);
}
