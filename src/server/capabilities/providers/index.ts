import type { FastifyInstance } from 'fastify';
import { createAiHostClient } from '../../platform/ai-host/client.js';
import type { RequireActor } from '../identity/index.js';
import { kitImportAi } from './adapters/kit-imports.js';
import { registerProviderRoutes } from './http/routes.js';

export { kitProvider } from './adapters/kit-ai.js';
/** What imports use of the user's AI: open an instance, and whether a run needs approval. */
export type ImportAi = ReturnType<typeof kitImportAi>;
export type { AiFailure, AiProvider } from './domain/ai-provider.js';

interface ProvidersSettings {
  aiHost: { url: string; token: string | null };
  requireActor: RequireActor;
}

/**
 * AI providers, models and subscriptions: the vendored T3 AI Providers Kit, run by ai-host/
 * and reached only through the AI host client (DEC-30).
 */
export function createProviders(settings: ProvidersSettings) {
  const client = createAiHostClient(settings.aiHost);
  return {
    client,
    /** The user's AI for imports (sources' `deps.ai`): instances of the kit. */
    importAi: kitImportAi(client),
    register: (app: FastifyInstance) => registerProviderRoutes(app, client, settings.requireActor),
  };
}
