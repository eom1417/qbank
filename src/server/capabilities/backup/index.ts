import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import type { RequireActor } from '../identity/index.js';
import { createBackupFiles } from './adapters/backup-files.js';
import { createCopyTarget } from './adapters/copy-target.js';
import { registerBackupRoutes } from './http/routes.js';
import { backupIfDue } from './use-cases/backups.js';

/**
 * Full local backups (M17.2): automatic once a day, on demand, and restorable with a preview.
 * Only a local install has them: there, the one owner is the whole install.
 */
export function createBackups(settings: { db: Db; clock: Clock; dataDir: string }) {
  const deps = {
    db: settings.db,
    clock: settings.clock,
    files: createBackupFiles(settings.dataDir),
    copies: createCopyTarget(settings.dataDir),
  };
  return {
    runDue: () => backupIfDue(deps),
    /** When the newest backup was made, if any (M17.3). */
    latest: async () => {
      const [newest] = await deps.files.list();
      return newest ? new Date(newest.meta.createdAt) : null;
    },
    register: (app: FastifyInstance, requireActor: RequireActor) =>
      registerBackupRoutes(app, deps, requireActor),
  };
}

export type Backups = ReturnType<typeof createBackups>;
