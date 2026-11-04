import { describe, expect, it } from 'vitest';
import { backupDue, backupsToKeep } from '../../src/server/capabilities/backup/domain/retention.js';

const DAY = 24 * 3600 * 1000;
const days = (count: number, from = Date.UTC(2026, 9, 1)) =>
  Array.from({ length: count }, (_, i) => new Date(from + i * DAY));

describe('which backups are kept', () => {
  it('keeps everything while there are seven or fewer', () => {
    expect([...backupsToKeep(days(7))].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('keeps the seven newest and one per earlier calendar week, four weeks at most', () => {
    const kept = backupsToKeep(days(60));
    expect(kept.size).toBe(11);
    for (let i = 53; i < 60; i++) expect(kept.has(i)).toBe(true);
  });

  it('is due once a day', () => {
    const now = new Date(Date.UTC(2026, 9, 2, 12));
    expect(backupDue(null, now)).toBe(true);
    expect(backupDue(new Date(now.getTime() - DAY + 1), now)).toBe(false);
    expect(backupDue(new Date(now.getTime() - DAY), now)).toBe(true);
  });
});
