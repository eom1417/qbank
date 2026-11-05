import { AppError } from '../errors/index.js';

/**
 * At most `limit` calls per key in each `windowMs` (a fixed window, in memory). For callers that
 * hold a key rather than a session (M23 channels): a runaway agent is slowed, nobody else is.
 */
export function createRateLimit(settings: { limit: number; windowMs: number; now?: () => number }) {
  const now = settings.now ?? Date.now;
  let windowStart = now();
  let counts = new Map<string, number>();
  return (key: string) => {
    if (now() - windowStart >= settings.windowMs) {
      windowStart = now();
      counts = new Map();
    }
    const used = (counts.get(key) ?? 0) + 1;
    counts.set(key, used);
    if (used > settings.limit) throw new AppError('too_many_attempts');
  };
}
