const DAY_MS = 24 * 60 * 60 * 1000;

export function sessionExpiresAt(now: Date, ttlDays: number): Date {
  return new Date(now.getTime() + ttlDays * DAY_MS);
}
