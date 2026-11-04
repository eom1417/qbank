/** Callers tracked at once; past this the oldest are forgotten, so spoofed keys cannot fill memory. */
const MAX_KEYS = 10_000;

/**
 * Counts failed attempts per caller in a sliding window, so a guessed secret (a pairing code, a
 * password) cannot be tried endlessly. In memory: a restart forgets, which is fine here.
 */
export function createAttemptLimiter(options: { max: number; windowMs: number; now: () => Date }) {
  const failures = new Map<string, number[]>();
  const recent = (key: string) => {
    const since = options.now().getTime() - options.windowMs;
    const list = (failures.get(key) ?? []).filter((at) => at > since);
    if (list.length === 0) failures.delete(key);
    else failures.set(key, list);
    return list;
  };
  const fail = (key: string) => {
    const list = [...recent(key), options.now().getTime()];
    failures.delete(key);
    failures.set(key, list);
    for (const oldest of failures.keys()) {
      if (MAX_KEYS >= failures.size) break;
      failures.delete(oldest);
    }
  };
  return {
    blocked: (key: string) => recent(key).length >= options.max,
    fail,
    clear: (key: string) => void failures.delete(key),
    /** Callers tracked now (tests check that memory stays bounded). */
    size: () => failures.size,
  };
}
