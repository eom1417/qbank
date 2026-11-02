import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { SecretBox } from '../../platform/crypto/secret-box.js';
import type { Db } from '../../platform/db/index.js';
import { newId } from '../../platform/ids.js';
import type { RequireActor } from '../identity/index.js';
import { isAllowedEndpoint } from './adapters/endpoint-guard.js';
import { createProviderFactory } from './adapters/provider-factory.js';
import { createProviderRepository } from './adapters/provider-repository.js';
import { createAiSettingsRepository } from './adapters/settings-repository.js';
import { registerLimitRoutes } from './http/limit-routes.js';
import { registerProviderRoutes } from './http/routes.js';

export { toProviderResponse } from './http/presenters.js';

interface AiSettings {
  db: Db;
  clock: Clock;
  secretBox: SecretBox;
  requireActor: RequireActor;
  localUrl: string | null;
  allowPrivateUrls: boolean;
}

/** BYOK keys, provider connections, readiness and cost limits (local-first, DEC-28). */
export function createAi(settings: AiSettings) {
  const { db, secretBox, localUrl, allowPrivateUrls, requireActor } = settings;
  const deps = {
    providers: createProviderRepository(db),
    settings: createAiSettingsRepository(db),
    openProvider: createProviderFactory({ secretBox, localUrl, allowPrivateUrls }),
    secretBox,
    isAllowedUrl: (url: string) => isAllowedEndpoint(url, allowPrivateUrls),
    localUrl,
    clock: settings.clock,
    newId,
  };
  return {
    register: (app: FastifyInstance) => {
      registerProviderRoutes(app, deps, requireActor);
      registerLimitRoutes(app, deps, requireActor);
    },
  };
}
