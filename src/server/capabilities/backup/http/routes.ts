import type { FastifyInstance } from 'fastify';
import { ConfirmRequest } from '../../../../contracts/portability.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import {
  createBackup,
  listBackups,
  previewRestore,
  restoreBackup,
  type BackupDeps,
} from '../use-cases/backups.js';

type IdParams = { Params: { id: string } };

/** Backups of the whole install (local mode: the one owner is the whole install). */
export function registerBackupRoutes(
  app: FastifyInstance,
  deps: BackupDeps,
  requireActor: RequireActor,
) {
  app.get('/api/backups', async (request) => {
    await requireActor(request);
    return listBackups(deps);
  });
  app.post('/api/backups', async (request, reply) => {
    await requireActor(request);
    return reply.status(201).send({ id: await createBackup(deps, 'manual') });
  });
  app.get<IdParams>('/api/backups/:id/preview', async (request) => {
    await requireActor(request);
    return previewRestore(deps, request.params.id);
  });
  app.post<IdParams>('/api/backups/:id/restore', async (request) => {
    await requireActor(request);
    parseInput(ConfirmRequest, request.body);
    return restoreBackup(deps, request.params.id);
  });
}
