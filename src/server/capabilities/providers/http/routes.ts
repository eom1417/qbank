import { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  KitMethod,
  KitReadMethod,
  KitStream,
  type ProviderAccessResponse,
} from '../../../../contracts/providers.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import type { AiHostClient } from '../../../platform/ai-host/client.js';
import type { RequireActor } from '../../identity/index.js';
import {
  driverFieldsOf,
  TenantMethod,
  tenantInputAllowed,
  type ProviderAccess,
} from '../domain/tenant-access.js';

type PeekQuery = { Querystring: { peek?: string } };
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
  access: ProviderAccess & { isSetUp(accountId: string): Promise<boolean> },
) {
  /**
   * The kit's state. `?peek=1` (screens that only list models to choose from): an account that
   * never set up its providers gets none, and no host is started just to be looked at (DEC-35).
   */
  app.get<PeekQuery>('/api/providers/state', async (request, reply) => {
    const actor = await requireActor(request);
    if (request.query.peek === '1' && !(await access.isSetUp(actor.accountId)))
      return { providers: [], settings: {} };
    const result = await client.read('/state', `account:${actor.accountId}`);
    return reply.status(result.status).send(result.body);
  });

  app.get('/api/providers/drivers', async (request, reply) => {
    const result = await client.read('/drivers', await ownerOf(requireActor, request));
    return reply.status(result.status).send(result.body);
  });

  app.get('/api/providers/state/events', async (request, reply) =>
    relayEvents(client, request, reply, '/state/events', await ownerOf(requireActor, request)),
  );

  app.get('/api/providers/access', async (request): Promise<ProviderAccessResponse> => {
    await requireActor(request);
    return { signIn: access.signIn, operator: access.operator };
  });

  app.post<MethodParams>('/api/providers/rpc/:method', async (request, reply) => {
    const owner = await ownerOf(requireActor, request);
    const method = await allowedMethod(client, access, owner, request);
    const result = await client.call(method, request.body ?? {}, owner);
    return reply.status(result.status).send(result.body);
  });

  app.get<MethodParams>('/api/providers/events/:method', async (request, reply) => {
    const owner = await ownerOf(requireActor, request);
    const method = KitStream.safeParse(request.params.method);
    const install = method.data === 'provider.install.subscribe';
    if (!method.success || !access.signIn || (install && !access.operator)) throw notFound();
    const input = encodeURIComponent(request.query.input ?? '{}');
    return relayEvents(client, request, reply, `/events/${method.data}?input=${input}`, owner);
  });
}

/**
 * The kit method this account may call with this input (DEC-35): the operator any of them, an
 * account on its own host its own sign-ins and providers only, else look and never change.
 */
async function allowedMethod(
  client: AiHostClient,
  access: ProviderAccess,
  owner: string,
  request: FastifyRequest<MethodParams>,
) {
  const schema = access.operator ? KitMethod : access.signIn ? TenantMethod : KitReadMethod;
  const parsed = schema.safeParse(request.params.method);
  if (!parsed.success) throw notFound();
  const method: string = parsed.data;
  if (access.operator || method !== 'server.updateSettings') return method;
  const drivers = await client.read('/drivers', owner);
  if (!tenantInputAllowed(method, request.body, driverFieldsOf(drivers.body)))
    throw new AppError('validation_failed');
  return method;
}
