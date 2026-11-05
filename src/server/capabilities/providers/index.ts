import type { FastifyInstance } from 'fastify';
import type { AiHosts } from '../../platform/ai-host/index.js';
import type { RequireActor } from '../identity/index.js';
import { kitImportAi } from './adapters/kit-imports.js';
import { accessOf } from './domain/tenant-access.js';
import { registerProviderRoutes } from './http/routes.js';
import { registerLoginRoutes } from './http/login-routes.js';
import { registerModelTestRoute } from './http/test-routes.js';

export { kitProvider } from './adapters/kit-ai.js';
/** What imports use of the user's AI: open an instance, and whether a run needs approval. */
export type ImportAi = ReturnType<typeof kitImportAi>;
export type {
  AiFailure,
  AiProvider,
  StructuredRequest,
  StructuredResult,
} from './domain/ai-provider.js';

interface ProvidersSettings {
  aiHosts: AiHosts;
  requireActor: RequireActor;
  mode: 'local' | 'accounts';
}

/**
 * AI providers, models and subscriptions: the vendored T3 AI Providers Kit, run by ai-host/
 * and reached only through the AI host client (DEC-30).
 */
export function createProviders(settings: ProvidersSettings) {
  const { client } = settings.aiHosts;
  const access = accessOf(settings.mode, settings.aiHosts.perAccount);
  return {
    client,
    /** The user's AI for imports (sources' `deps.ai`): instances of the kit. */
    importAi: kitImportAi(client),
    /** Whether the account ever set up its providers (browsing never starts a host). */
    isSetUp: settings.aiHosts.isSetUp,
    /** Deletes an account's own sign-ins and keys with its host (M22.4). */
    forgetAccount: settings.aiHosts.forget,
    register: (app: FastifyInstance) => {
      registerProviderRoutes(app, client, settings.requireActor, {
        ...access,
        isSetUp: settings.aiHosts.isSetUp,
      });
      if (!access.signIn) return;
      registerLoginRoutes(app, client, settings.requireActor);
      registerModelTestRoute(app, client, settings.requireActor);
    },
  };
}
