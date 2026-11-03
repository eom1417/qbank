import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { SecretBox } from '../../platform/crypto/secret-box.js';
import type { Db } from '../../platform/db/index.js';
import { newId } from '../../platform/ids.js';
import type { RequireActor } from '../identity/index.js';
import { isAllowedEndpoint } from './adapters/endpoint-guard.js';
import {
  createProviderFactory,
  providerFor,
  type ProviderTarget,
} from './adapters/provider-factory.js';
import { createProviderRepository } from './adapters/provider-repository.js';
import { createAiSettingsRepository } from './adapters/settings-repository.js';
import { registerLimitRoutes } from './http/limit-routes.js';
import { registerProviderRoutes, registerReadinessRoutes } from './http/routes.js';

export { toProviderResponse } from './http/presenters.js';
// For tools that read with a provider directly (the extraction benchmark); the app uses saved
// connections only.
export { providerFor, type ProviderTarget } from './adapters/provider-factory.js';
export type { AiProvider } from './domain/ai-provider.js';

interface AiSettings {
  db: Db;
  clock: Clock;
  secretBox: SecretBox;
  requireActor: RequireActor;
  allowPrivateUrls: boolean;
}

/** BYOK keys, provider connections, readiness and cost limits: the user's own AI (DEC-17, DEC-28). */
export function createAi(settings: AiSettings) {
  const { db, secretBox, allowPrivateUrls, requireActor } = settings;
  const deps = {
    providers: createProviderRepository(db),
    settings: createAiSettingsRepository(db),
    openProvider: createProviderFactory({ secretBox, allowPrivateUrls }),
    listModels: (target: ProviderTarget) => providerFor(target, allowPrivateUrls).listModels(),
    secretBox,
    isAllowedUrl: (url: string) => isAllowedEndpoint(url, allowPrivateUrls),
    clock: settings.clock,
    newId,
  };
  return {
    register: (app: FastifyInstance) => {
      registerProviderRoutes(app, deps, requireActor);
      registerReadinessRoutes(app, deps, requireActor);
      registerLimitRoutes(app, deps, requireActor);
    },
  };
}
