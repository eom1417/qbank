import type { FastifyInstance } from 'fastify';
import {
  ChannelSettings,
  ChannelUpdate,
  type ChannelKeyResponse,
  type ChannelListResponse,
  type ChannelStats,
  type ChannelView,
} from '../../../../contracts/channels.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { ChannelsDeps } from '../use-cases/deps.js';
import {
  channelStats,
  createChannel,
  listChannels,
  ownedChannel,
  removeChannel,
  renewKey,
  updateChannel,
} from '../use-cases/manage.js';

type BankParams = { Params: { bankId: string } };
type IdParams = { Params: { id: string } };

/** The owner's channel screens (signed in): set up, pause, new key, delete, numbers. */
export function registerOwnerRoutes(
  app: FastifyInstance,
  deps: ChannelsDeps,
  requireActor: RequireActor,
) {
  app.get<BankParams>(
    '/api/banks/:bankId/channels',
    async (request): Promise<ChannelListResponse> =>
      listChannels(deps, await requireActor(request), request.params.bankId),
  );

  app.post<BankParams>('/api/banks/:bankId/channels', async (request, reply) => {
    const actor = await requireActor(request);
    const settings = parseInput(ChannelSettings, request.body);
    const created: ChannelKeyResponse = await createChannel(
      deps,
      actor,
      request.params.bankId,
      settings,
    );
    return reply.status(201).send(created);
  });

  app.patch<IdParams>('/api/channels/:id', async (request): Promise<ChannelView> => {
    const actor = await requireActor(request);
    return updateChannel(deps, actor, request.params.id, parseInput(ChannelUpdate, request.body));
  });

  app.post<IdParams>('/api/channels/:id/key', async (request): Promise<ChannelKeyResponse> =>
    renewKey(deps, await requireActor(request), request.params.id),
  );

  app.delete<IdParams>('/api/channels/:id', async (request, reply) => {
    await removeChannel(deps, await requireActor(request), request.params.id);
    return reply.status(204).send();
  });

  app.get<IdParams>('/api/channels/:id/stats', async (request): Promise<ChannelStats> => {
    const row = await ownedChannel(deps, await requireActor(request), request.params.id);
    return channelStats(deps, row);
  });
}
