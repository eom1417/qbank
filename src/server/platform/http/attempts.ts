/**
 * Counts failed attempts per caller in a sliding window, so a guessed secret (a pairing code)
 * cannot be tried endlessly. In memory: a restart forgets, which is fine for one computer.
 */
export function createAttemptLimiter(options: { max: number; windowMs: number; now: () => Date }) {
  const failures = new Map<string, number[]>();
  const recent = (key: string) => {
    const since = options.now().getTime() - options.windowMs;
    const list = (failures.get(key) ?? []).filter((at) => at > since);
    failures.set(key, list);
    return list;
  };
  return {
    blocked: (key: string) => recent(key).length >= options.max,
    fail: (key: string) => void recent(key).push(options.now().getTime()),
    clear: (key: string) => void failures.delete(key),
  };
}
