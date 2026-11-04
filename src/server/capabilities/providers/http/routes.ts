import { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { KitMethod, KitReadMethod, KitStream } from '../../../../contracts/providers.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import type { AiHostClient } from '../../../platform/ai-host/client.js';
import type { RequireActor } from '../../identity/index.js';

type MethodParams = { Params: { method: string }; Querystring: { input?: string } };

/** A sign-in flow belongs to the QBank account that started it (kit: ownerSessionId). */
export const ownerOf = async (requireActor: RequireActor, request: FastifyRequest) =>
  `account:${(await requireActor(request)).accountId}`;

/** Relays the AI host's server-sent events to the browser until either side closes. */
async function relayEvents(
  client: AiHostClient,
  request: FastifyRequest,
  reply: FastifyReply,
  path: string,
  owner: string,
) {
  const abort = new AbortController();
  request.raw.on('close', () => abort.abort());
  const upstream = await client.open(path, owner, abort.signal);
  if (!upstream.ok || !upstream.body) throw new AppError('ai_host_unavailable');
  reply.hijack();
  reply.raw.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no',
  });
  Readable.fromWeb(upstream.body as never)
    .on('error', () => reply.raw.end())
    .pipe(reply.raw);
}

/**
 * The providers screens' API: the kit's state, its live changes, and one route per kit method.
 * Only the kit methods QBank uses pass; the kit validates every input with its own schemas.
 */
export function registerProviderRoutes(
  app: FastifyInstance,
  client: AiHostClient,
  requireActor: RequireActor,
  /** Settings, installs and sign-in flows: only where the account runs the install (local). */
  manage: boolean,
) {
  app.get('/api/providers/state', async (request, reply) => {
    const result = await client.read('/state', await ownerOf(requireActor, request));
    return reply.status(result.status).send(result.body);
  });

  app.get('/api/providers/drivers', async (request, reply) => {
    const result = await client.read('/drivers', await ownerOf(requireActor, request));
    return reply.status(result.status).send(result.body);
  });

  app.get('/api/providers/state/events', async (request, reply) =>
    relayEvents(client, request, reply, '/state/events', await ownerOf(requireActor, request)),
  );

  app.post<MethodParams>('/api/providers/rpc/:method', async (request, reply) => {
    const owner = await ownerOf(requireActor, request);
    const method = (manage ? KitMethod : KitReadMethod).safeParse(request.params.method);
    if (!method.success) throw notFound();
    const result = await client.call(method.data, request.body ?? {}, owner);
    return reply.status(result.status).send(result.body);
  });

  app.get<MethodParams>('/api/providers/events/:method', async (request, reply) => {
    const owner = await ownerOf(requireActor, request);
    const method = KitStream.safeParse(request.params.method);
    if (!manage || !method.success) throw notFound();
    const input = encodeURIComponent(request.query.input ?? '{}');
    return relayEvents(client, request, reply, `/events/${method.data}?input=${input}`, owner);
  });
}
