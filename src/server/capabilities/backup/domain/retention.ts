/** The newest backups kept whatever their age. */
const DAILY = 7;
/** Beyond those, the newest backup of each of this many earlier weeks. */
const WEEKLY = 4;
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** A day's automatic backup is due when the newest one is older than this. */
const BACKUP_EVERY_MS = 24 * 3600 * 1000;

/**
 * Which backups to keep (M17.2): the 7 newest, then the newest one of each of the 4 calendar
 * weeks before them. Everything else may be removed. Input order does not matter.
 */
export function backupsToKeep(createdAt: readonly Date[]): Set<number> {
  const newestFirst = createdAt
    .map((date, index) => ({ time: date.getTime(), index }))
    .sort((a, b) => b.time - a.time);
  const keep = new Set(newestFirst.slice(0, DAILY).map((b) => b.index));
  // Fixed calendar weeks, so a week's kept backup stays put as days pass (pruning runs daily).
  const weeks = new Set<number>();
  for (const backup of newestFirst.slice(DAILY)) {
    const week = Math.floor(backup.time / WEEK_MS);
    if (weeks.has(week)) continue;
    if (weeks.size >= WEEKLY) break;
    weeks.add(week);
    keep.add(backup.index);
  }
  return keep;
}

/** Whether today's automatic backup is still to be made. */
export const backupDue = (newest: Date | null, now: Date) =>
  newest === null || now.getTime() - newest.getTime() >= BACKUP_EVERY_MS;
