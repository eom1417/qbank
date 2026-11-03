import type { FastifyInstance } from 'fastify';
import { createAiHostClient } from '../../platform/ai-host/client.js';
import type { RequireActor } from '../identity/index.js';
import { registerProviderRoutes } from './http/routes.js';

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
    register: (app: FastifyInstance) => registerProviderRoutes(app, client, settings.requireActor),
  };
}
