import type { FastifyInstance } from 'fastify';
import type { ChannelStats } from '../../../../contracts/channels.js';
import {
  CreateShareRequest,
  ExposureRequest,
  UpdateShareRequest,
  type ExposureResponse,
  type ShareEventsResponse,
  type ShareListResponse,
  type ShareView,
} from '../../../../contracts/sharing.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { ChannelsDeps } from '../use-cases/deps.js';
import { shareStats } from '../use-cases/shares-control.js';
import { exposure } from '../use-cases/shares-exposure.js';
import { listShares, shareEvents, shareView } from '../use-cases/shares-view.js';
import { createShare, updateShare } from '../use-cases/shares.js';

type BankParams = { Params: { bankId: string } };
type IdParams = { Params: { id: string } };
type ListQuery = { Querystring: { bankId?: string } };

/** The owner's shares (signed in, DEC-39): the hub, a bank's shares, one share and its record. */
export function registerShareRoutes(
  app: FastifyInstance,
  deps: ChannelsDeps,
  requireActor: RequireActor,
) {
  app.get<ListQuery>('/api/shares', async (request): Promise<ShareListResponse> =>
    listShares(deps, await requireActor(request), request.query.bankId),
  );

  app.post<BankParams>('/api/banks/:bankId/shares', async (request, reply) => {
    const actor = await requireActor(request);
    const input = parseInput(CreateShareRequest, request.body);
    return reply.status(201).send(await createShare(deps, actor, request.params.bankId, input));
  });

  app.post<BankParams>(
    '/api/banks/:bankId/shares/exposure',
    async (request): Promise<ExposureResponse> => {
      const actor = await requireActor(request);
      const scope = parseInput(ExposureRequest, request.body);
      return exposure(deps, actor, request.params.bankId, scope);
    },
  );

  app.get<IdParams>('/api/shares/:id', async (request): Promise<ShareView> =>
    shareView(deps, await requireActor(request), request.params.id),
  );

  app.patch<IdParams>('/api/shares/:id', async (request): Promise<ShareView> => {
    const actor = await requireActor(request);
    const input = parseInput(UpdateShareRequest, request.body);
    return updateShare(deps, actor, request.params.id, input);
  });

  app.get<IdParams>('/api/shares/:id/events', async (request): Promise<ShareEventsResponse> =>
    shareEvents(deps, await requireActor(request), request.params.id),
  );

  app.get<IdParams>('/api/shares/:id/stats', async (request): Promise<ChannelStats> =>
    shareStats(deps, await requireActor(request), request.params.id),
  );
}
