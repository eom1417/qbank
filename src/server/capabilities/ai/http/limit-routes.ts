import type { FastifyInstance } from 'fastify';
import {
  EstimateRequest,
  UpdateAiSettingsRequest,
  type AiSettings,
  type EstimateResponse,
} from '../../../../contracts/ai.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { AiDeps } from '../use-cases/deps.js';
import { estimateTask, getAiSettings, updateAiSettings } from '../use-cases/limits.js';

/** Spending limits and estimates for AI tasks (FR-08-012, FR-22-008, DEC-18). */
export function registerLimitRoutes(
  app: FastifyInstance,
  deps: AiDeps,
  requireActor: RequireActor,
) {
  app.get('/api/ai/settings', async (request): Promise<AiSettings> =>
    getAiSettings(deps, await requireActor(request)),
  );

  app.patch('/api/ai/settings', async (request): Promise<AiSettings> => {
    const actor = await requireActor(request);
    return updateAiSettings(deps, actor, parseInput(UpdateAiSettingsRequest, request.body));
  });

  app.post('/api/ai/estimate', async (request): Promise<EstimateResponse> => {
    const actor = await requireActor(request);
    return estimateTask(deps, actor, parseInput(EstimateRequest, request.body));
  });
}
