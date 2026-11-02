import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import { newId } from '../../platform/ids.js';
import type { RequireActor } from '../identity/index.js';
import { createBankRepository } from './adapters/bank-repository.js';
import { registerLibraryRoutes } from './http/routes.js';

export { toBankResponse } from './http/presenters.js';

interface LibrarySettings {
  db: Db;
  clock: Clock;
  requireActor: RequireActor;
}

export function createLibrary(settings: LibrarySettings) {
  const deps = { banks: createBankRepository(settings.db), clock: settings.clock, newId };
  return {
    register: (app: FastifyInstance) => registerLibraryRoutes(app, deps, settings.requireActor),
  };
}
