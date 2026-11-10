import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { ServerStatusResponse } from '../../../../contracts/operator.js';

/** The last automatic backup as the operator sees it (M32). */
export type BackupStatus = NonNullable<ServerStatusResponse['backup']>;

/** status.json from scripts/server-backup.sh; its other fields (the error text) stay on disk. */
const StatusFile = z.object(ServerStatusResponse.shape.backup.unwrap().shape);

/** The file's content, or null when it is not a status the backup service writes. */
export function parseBackupStatus(text: string): BackupStatus | null {
  try {
    const parsed = StatusFile.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Reads the backup service's status file each time it is asked: no file configured, none written
 * yet, or an unreadable one all mean "no backup known".
 */
export function createBackupStatusReader(file: string | null): () => Promise<BackupStatus | null> {
  return async () => {
    if (!file) return null;
    const text = await readFile(file, 'utf8').catch(() => null);
    return text === null ? null : parseBackupStatus(text);
  };
}
