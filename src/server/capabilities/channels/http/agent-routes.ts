import type { FastifyInstance, FastifyRequest } from 'fastify';
import { BatchRequest, ChannelAnswerRequest } from '../../../../contracts/channels.js';
import { createRateLimit } from '../../../platform/http/rate-limit.js';
import { sendPng } from '../../../platform/http/send-png.js';
import { parseInput } from '../../../platform/http/validate.js';
import {
  batchAnswers,
  channelOfKey,
  channelPicture,
  nextBatch,
  recordAnswer,
} from '../use-cases/agent.js';
import type { ChannelsDeps } from '../use-cases/deps.js';
import { channelStats } from '../use-cases/manage.js';
import { registerMcpRoute } from './mcp-route.js';

type IdParams = { Params: { id: string } };

/** Calls one channel's key may make in a minute: far above a daily agent, far below a flood. */
const PER_MINUTE = 120;

/**
 * The agent's API (DEC-36), version 1: the channel's key in `Authorization: Bearer qbc_…`, no
 * session and no cookie. Each key reaches its own channel only.
 */
export function registerAgentRoutes(app: FastifyInstance, deps: ChannelsDeps) {
  const limit = createRateLimit({ limit: PER_MINUTE, windowMs: 60_000 });
  const channelOf = async (request: FastifyRequest) => {
    const row = await channelOfKey(deps, request.headers.authorization);
    limit(row.id);
    return row;
  };

  app.post('/api/channel/v1/batches', async (request) => {
    const row = await channelOf(request);
    const input = parseInput(BatchRequest, request.body ?? {});
    return nextBatch(deps, row, input.key);
  });

  app.get<IdParams>('/api/channel/v1/batches/:id/answers', async (request) =>
    batchAnswers(deps, await channelOf(request), request.params.id),
  );

  app.post('/api/channel/v1/answers', async (request) => {
    const row = await channelOf(request);
    return recordAnswer(deps, row, parseInput(ChannelAnswerRequest, request.body));
  });

  app.get('/api/channel/v1/stats', async (request) => channelStats(deps, await channelOf(request)));

  registerMcpRoute(app, deps, channelOf);

  app.get<IdParams>('/api/channel/v1/pictures/:id', async (request, reply) => {
    return sendPng(reply, await channelPicture(deps, await channelOf(request), request.params.id));
  });
}
