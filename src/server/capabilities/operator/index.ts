import type { FastifyInstance } from 'fastify';
import type { Db } from '../../platform/db/index.js';
import type { RequireActor } from '../identity/index.js';
import { createBackupStatusReader } from './adapters/backup-status-file.js';
import { createFeedbackRepository } from './adapters/feedback-repository.js';
import { registerFeedbackRoute, registerOperatorRoutes } from './http/routes.js';
import type { OperatorDeps } from './use-cases/deps.js';

interface OperatorSettings extends Omit<OperatorDeps, 'feedback' | 'backupStatus'> {
  db: Db;
  /** The backup service's status.json (`config.backupStatusFile`, M32); null: none configured. */
  backupStatusFile: string | null;
  requireActor: RequireActor;
  /** Identity's operator gate (DEC-40). */
  requireOperator: RequireActor;
}

/**
 * The server operator's console (M31, DEC-40): users' feedback, password resets handed over by
 * hand, the import queue, and the last backup (M32). Accounts mode only: a local install
 * registers none of it.
 */
export function createOperator(settings: OperatorSettings) {
  const { db, requireActor, requireOperator, backupStatusFile, ...rest } = settings;
  const deps = {
    ...rest,
    feedback: createFeedbackRepository(db),
    backupStatus: createBackupStatusReader(backupStatusFile),
  };
  return {
    register(app: FastifyInstance) {
      registerFeedbackRoute(app, deps, requireActor);
      registerOperatorRoutes(app, deps, requireOperator);
    },
  };
}
