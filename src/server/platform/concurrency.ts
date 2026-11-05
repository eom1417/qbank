/**
 * Runs `work` on every item with at most `limit` running at once, results in input order. Used
 * where requests go to the user's own AI subscription, which allows a few at a time.
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}
