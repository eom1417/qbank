/** One run at a time per key (a connection id): later runs wait for earlier ones. */
export function createExclusive() {
  const tails = new Map<string, Promise<unknown>>();
  return function exclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work);
    tails.set(key, next);
    void next.finally(() => {
      if (tails.get(key) === next) tails.delete(key);
    });
    return next;
  };
}
