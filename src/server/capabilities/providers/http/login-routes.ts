import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  CliLoginCodeRequest,
  CliLoginStartRequest,
  CliLogoutRequest,
} from '../../../../contracts/providers.js';
import type { AiHostClient } from '../../../platform/ai-host/client.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import { ownerOf } from './routes.js';

type LoginParams = { Params: { id: string } };

const pass = (reply: FastifyReply, result: { status: number; body: unknown }) =>
  reply.status(result.status).send(result.body);

/**
 * Sign-in through the providers' official CLIs (ai-host cli-login): start one, follow it, paste
 * the code the provider's page shows, cancel it, or sign out. Inputs are checked here first.
 */
export function registerLoginRoutes(
  app: FastifyInstance,
  client: AiHostClient,
  requireActor: RequireActor,
) {
  const id = (request: FastifyRequest<LoginParams>) => encodeURIComponent(request.params.id);

  app.post('/api/providers/login', async (request, reply) => {
    const input = parseInput(CliLoginStartRequest, request.body);
    return pass(
      reply,
      await client.post('/login/start', input, await ownerOf(requireActor, request)),
    );
  });

  app.get<LoginParams>('/api/providers/login/:id', async (request, reply) =>
    pass(reply, await client.read(`/login/${id(request)}`, await ownerOf(requireActor, request))),
  );

  app.post<LoginParams>('/api/providers/login/:id/code', async (request, reply) => {
    const input = parseInput(CliLoginCodeRequest, request.body);
    const owner = await ownerOf(requireActor, request);
    return pass(reply, await client.post(`/login/${id(request)}/code`, input, owner));
  });

  app.post<LoginParams>('/api/providers/login/:id/cancel', async (request, reply) => {
    const owner = await ownerOf(requireActor, request);
    return pass(reply, await client.post(`/login/${id(request)}/cancel`, {}, owner));
  });

  app.post('/api/providers/logout', async (request, reply) => {
    const input = parseInput(CliLogoutRequest, request.body);
    return pass(
      reply,
      await client.post('/login/logout', input, await ownerOf(requireActor, request)),
    );
  });
}
