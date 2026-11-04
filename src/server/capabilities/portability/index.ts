import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import type { RequireActor } from '../identity/index.js';
import { registerPortabilityRoutes } from './http/routes.js';
import type { PortabilityDeps } from './use-cases/deps.js';

/** Export, restore and deletion (M13), through the other capabilities' public interfaces. */
export function createPortability(deps: PortabilityDeps, requireActor: RequireActor) {
  return {
    register: (app: FastifyInstance) => {
      void app.register(async (scope) => {
        await scope.register(multipart);
        registerPortabilityRoutes(scope, deps, requireActor);
      });
    },
  };
}
