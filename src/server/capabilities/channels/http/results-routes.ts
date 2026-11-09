import type { FastifyInstance } from 'fastify';
import type { ShareResultsResponse } from '../../../../contracts/sharing.js';
import type { RequireActor } from '../../identity/index.js';
import type { ChannelsDeps } from '../use-cases/deps.js';
import { shareResults } from '../use-cases/results.js';

type IdParams = { Params: { id: string } };

/** The owner's view of an exam/practice share's attempts (M30), signed in. */
export function registerResultsRoutes(
  app: FastifyInstance,
  deps: ChannelsDeps,
  requireActor: RequireActor,
) {
  app.get<IdParams>('/api/shares/:id/results', async (request): Promise<ShareResultsResponse> =>
    shareResults(deps, await requireActor(request), request.params.id),
  );
}
