import type { FastifyInstance } from 'fastify';
import {
  CreateProviderRequest,
  ListModelsRequest,
  UpdateProviderRequest,
  type CheckResponse,
  type ListModelsResponse,
  type ProviderListResponse,
  type TrialResponse,
} from '../../../../contracts/ai.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { AiDeps } from '../use-cases/deps.js';
import {
  createProvider,
  deleteProvider,
  listModelsFor,
  listProviders,
  makeDefaultProvider,
  updateProvider,
} from '../use-cases/providers.js';
import { checkProvider, runTrial } from '../use-cases/readiness.js';
import { toProviderResponse, toReadiness } from './presenters.js';

type IdParams = { Params: { id: string } };

/** AI connections of the signed-in account (UI-24, FR-22-002). */
export function registerProviderRoutes(
  app: FastifyInstance,
  deps: AiDeps,
  requireActor: RequireActor,
) {
  app.get('/api/ai/providers', async (request): Promise<ProviderListResponse> => {
    const actor = await requireActor(request);
    const providers = (await listProviders(deps, actor)).map(toProviderResponse);
    return { providers };
  });

  app.post('/api/ai/providers', async (request, reply) => {
    const actor = await requireActor(request);
    const input = parseInput(CreateProviderRequest, request.body);
    return reply.status(201).send(toProviderResponse(await createProvider(deps, actor, input)));
  });

  app.patch<IdParams>('/api/ai/providers/:id', async (request) => {
    const actor = await requireActor(request);
    const input = parseInput(UpdateProviderRequest, request.body);
    return toProviderResponse(await updateProvider(deps, actor, request.params.id, input));
  });

  app.post<IdParams>('/api/ai/providers/:id/default', async (request, reply) => {
    await makeDefaultProvider(deps, await requireActor(request), request.params.id);
    return reply.status(204).send();
  });

  app.delete<IdParams>('/api/ai/providers/:id', async (request, reply) => {
    await deleteProvider(deps, await requireActor(request), request.params.id);
    return reply.status(204).send();
  });
}

/** Readiness, trial task and model listing for the user's own keys (FR-08-011). */
export function registerReadinessRoutes(
  app: FastifyInstance,
  deps: AiDeps,
  requireActor: RequireActor,
) {
  app.post('/api/ai/models', async (request): Promise<ListModelsResponse> => {
    await requireActor(request);
    return listModelsFor(deps, parseInput(ListModelsRequest, request.body));
  });

  app.post<IdParams>('/api/ai/providers/:id/check', async (request): Promise<CheckResponse> => {
    const actor = await requireActor(request);
    const { connection, fromCache } = await checkProvider(deps, actor, request.params.id);
    return { readiness: toReadiness(connection), fromCache };
  });

  app.post<IdParams>('/api/ai/providers/:id/trial', async (request): Promise<TrialResponse> => {
    const actor = await requireActor(request);
    const trial = await runTrial(deps, actor, request.params.id);
    return {
      outcome: trial.outcome,
      readiness: toReadiness(trial.connection),
      question: trial.question,
    };
  });
}
