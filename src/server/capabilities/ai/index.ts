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
import { clearAccountHomes, createLoginManager, opsFor } from './adapters/accounts/index.js';
import { registerAccountRoutes } from './http/account-routes.js';
import { registerLimitRoutes } from './http/limit-routes.js';
import { registerProviderRoutes, registerReadinessRoutes } from './http/routes.js';
import { saveAccountLogin, saveRefreshedLogin } from './use-cases/accounts.js';
import type { AiDeps } from './use-cases/deps.js';

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
  claudeBin: string;
  codexBin: string;
  workDir: string;
  cliEnv: Record<string, string>;
}

/**
 * The user's own AI (DEC-17, DEC-28): API keys, or Claude/ChatGPT subscription accounts signed in
 * through the official CLIs; readiness and cost limits.
 */
export function createAi(settings: AiSettings) {
  const { db, secretBox, allowPrivateUrls, requireActor } = settings;
  const accounts = {
    claudeBin: settings.claudeBin,
    codexBin: settings.codexBin,
    workDir: settings.workDir,
    cliEnv: settings.cliEnv,
  };
  const providers = createProviderRepository(db);
  void clearAccountHomes(accounts.workDir);
  const deps: AiDeps = {
    providers,
    settings: createAiSettingsRepository(db),
    openProvider: createProviderFactory({
      secretBox,
      allowPrivateUrls,
      accounts,
      saveCredential: (connection, credential) => saveRefreshedLogin(deps, connection, credential),
    }),
    listModels: (target: ProviderTarget) => providerFor(target, allowPrivateUrls).listModels(),
    logins: createLoginManager({
      home: accounts,
      opsFor: (provider) => opsFor(accounts, provider),
      onComplete: (login) => saveAccountLogin(deps, login),
      newId,
    }),
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
      registerAccountRoutes(app, deps, requireActor);
    },
  };
}
