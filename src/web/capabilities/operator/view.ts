import type { FeedbackItem, QueueItem, ServerStatusResponse } from '../../../contracts/operator.js';

const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) =>
  b.createdAt.localeCompare(a.createdAt);

/** The notes still waiting for the operator, newest first. */
export function openFeedback(items: readonly FeedbackItem[]): FeedbackItem[] {
  return items.filter((item) => item.closedAt === null).sort(newestFirst);
}

/** Running imports first, then waiting ones; each group oldest first (the order they run in). */
export function queueOrder(items: readonly QueueItem[]): QueueItem[] {
  const rank = (item: QueueItem) => (item.state === 'running' ? 0 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b) || a.since.localeCompare(b.since));
}

/** A WhatsApp share link with the text ready; the operator picks the person in WhatsApp. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** A backup older than this is late: the service runs daily, so two days means it stopped. */
export const BACKUP_LATE_MS = 48 * 60 * 60 * 1000;

/** How the last backup stands: none ever ran, it failed, it is late, or all is well. */
export type BackupHealth = 'none' | 'failed' | 'late' | 'ok';

export function backupHealth(backup: ServerStatusResponse['backup'], now: Date): BackupHealth {
  if (!backup) return 'none';
  if (!backup.ok) return 'failed';
  return now.getTime() - Date.parse(backup.at) > BACKUP_LATE_MS ? 'late' : 'ok';
}
