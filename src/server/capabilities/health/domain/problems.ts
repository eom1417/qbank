/** What QBank knows about itself now, gathered from each owner through its public interface. */
export interface HealthSnapshot {
  /** `not_configured`: this install runs without the AI service, which is optional. */
  aiHost: 'reachable' | 'unreachable' | 'not_configured';
  /** Providers on and signed in. */
  aiReady: number;
  diskFreeBytes: number | null;
  /** Null when this install makes no backups (accounts mode) or none yet. */
  lastBackupAt: Date | null;
  backups: boolean;
  lastFailedImport: { fileName: string; stage: string; at: Date | null } | null;
}

export type HealthProblem = 'ai_unreachable' | 'disk_low' | 'backup_old' | 'import_failed';

/** Below this, new imports and backups may not fit. */
const LOW_DISK_BYTES = 1024 * 1024 * 1024;
/** A daily backup missed twice in a row means something stops it. */
const BACKUP_LATE_MS = 48 * 3600 * 1000;

/**
 * What needs the owner's attention (M17.3), shown in the app only: nothing is sent anywhere.
 * An empty list means all is well.
 */
export function problemsOf(health: HealthSnapshot, now: Date): HealthProblem[] {
  const problems: HealthProblem[] = [];
  // AI is optional: only a configured service that does not answer is a problem.
  if (health.aiHost === 'unreachable') problems.push('ai_unreachable');
  if (health.diskFreeBytes !== null && LOW_DISK_BYTES > health.diskFreeBytes)
    problems.push('disk_low');
  const backupAge = health.lastBackupAt ? now.getTime() - health.lastBackupAt.getTime() : Infinity;
  if (health.backups && backupAge > BACKUP_LATE_MS) problems.push('backup_old');
  if (health.lastFailedImport) problems.push('import_failed');
  return problems;
}
