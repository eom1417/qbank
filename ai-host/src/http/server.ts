import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';

import { dispatch } from '../bridge/dispatch.ts';
import { encodeSuccess } from '../bridge/rpc.ts';
import { listDrivers } from '../bridge/drivers.ts';
import { readState, stateChanges } from '../bridge/state.ts';
import { handleAsk } from '../turns/route.ts';
import { loginRoute } from '../cli-login/routes.ts';
import type { StreamOpener, TaggedFailure, UnaryHandler } from '../bridge/types.ts';
import type { HostConfig } from '../config.ts';
import type { KitRuntime } from '../runtime.ts';
import { allowed, ownerSessionOf, readJson } from './guard.ts';

export interface Routes {
  /** Where provider sessions run (the kit's cwd). */
  readonly cwd: string;
  readonly unary: Readonly<Record<string, UnaryHandler>>;
  readonly streams: Readonly<Record<string, StreamOpener>>;
}

const send = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
};

const eventLine = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;

/** Streams events as server-sent events until the caller goes away. */
function sse(
  runtime: KitRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  events: Stream.Stream<unknown, TaggedFailure>,
) {
  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  const write = (event: unknown) => Effect.sync(() => response.write(eventLine(event)));
  const fiber = runtime.runFork(
    Stream.runForEach(events, write).pipe(
      Effect.ignore,
      Effect.ensuring(Effect.sync(() => response.end())),
    ),
  );
  request.on('close', () => void runtime.runPromise(Fiber.interrupt(fiber)));
}

async function streamCall(
  runtime: KitRuntime,
  routes: Routes,
  method: string,
  request: IncomingMessage,
  response: ServerResponse,
  owner: string,
) {
  const opener = routes.streams[method];
  if (!opener) return send(response, 404, { error: { _tag: 'UnknownMethod', method } });
  const input = JSON.parse(
    new URL(request.url ?? '', 'http://local').searchParams.get('input') ?? '{}',
  ) as unknown;
  const opened = await runtime.runPromiseExit(opener(input as never, { ownerSessionId: owner }));
  if (opened._tag === 'Failure') return send(response, 422, { error: { _tag: 'StreamFailed' } });
  sse(
    runtime,
    request,
    response,
    opened.value.pipe(Stream.mapEffect((item) => encodeSuccess(method, item))),
  );
}

/** Reads a JSON body, runs it, and sends the reply; a body that is not JSON is a 400. */
async function withJsonBody(
  request: IncomingMessage,
  response: ServerResponse,
  run: (input: unknown) => Promise<{ readonly status: number; readonly body: unknown }>,
) {
  const input = await readJson(request);
  if (input === null)
    return send(response, 400, { error: { _tag: 'InvalidInput', message: 'Body must be JSON.' } });
  const reply = await run(input);
  send(response, reply.status, reply.body);
}

async function unaryCall(
  runtime: KitRuntime,
  routes: Routes,
  method: string,
  request: IncomingMessage,
  response: ServerResponse,
  owner: string,
) {
  await withJsonBody(request, response, (input) =>
    runtime.runPromise(dispatch(routes.unary, method, input, { ownerSessionId: owner })),
  );
}

/** The driver definitions, the provider state snapshot and its live changes. */
async function stateRoute(
  runtime: KitRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
) {
  if (request.method !== 'GET') return false;
  if (path === '/drivers') send(response, 200, { drivers: listDrivers() });
  else if (path === '/state') send(response, 200, await runtime.runPromise(readState));
  else if (path === '/state/events')
    sse(runtime, request, response, await runtime.runPromise(stateChanges));
  else return false;
  return true;
}

/** `POST /rpc/<method>` and `GET /events/<method>`: one kit method each. */
async function methodRoute(
  runtime: KitRuntime,
  routes: Routes,
  request: IncomingMessage,
  response: ServerResponse,
  owner: string,
) {
  const [, kind, method = ''] = new URL(request.url ?? '/', 'http://local').pathname.split('/');
  if (request.method === 'POST' && kind === 'rpc')
    return unaryCall(runtime, routes, method, request, response, owner);
  if (request.method === 'GET' && kind === 'events')
    return streamCall(runtime, routes, method, request, response, owner);
  send(response, 404, { error: { _tag: 'NotFound' } });
}

/** `POST /ask`: QBank's one-shot question (the session owner in turns/). */
async function askRoute(
  runtime: KitRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  cwd: string,
) {
  await withJsonBody(request, response, (input) => runtime.runPromise(handleAsk(input, cwd)));
}

async function route(
  runtime: KitRuntime,
  routes: Routes,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const path = new URL(request.url ?? '/', 'http://local').pathname;
  if (path === '/health') return send(response, 200, { status: 'ok' });
  const owner = ownerSessionOf(request);
  if (!owner) return send(response, 400, { error: { _tag: 'MissingOwnerSession' } });
  if (await stateRoute(runtime, request, response, path)) return;
  const login = await loginRoute(request, path, owner);
  if (login) return send(response, login.status, login.body);
  if (request.method === 'POST' && path === '/ask')
    return askRoute(runtime, request, response, routes.cwd);
  await methodRoute(runtime, routes, request, response, owner);
}

/** The loopback HTTP surface of the kit: one route per T3 provider method, guarded by the token. */
export function startServer(runtime: KitRuntime, routes: Routes, config: HostConfig) {
  const server = createServer((request, response) => {
    if (!allowed(request, config.token, config.port))
      return send(response, 401, { error: { _tag: 'Unauthorized' } });
    route(runtime, routes, request, response).catch(() => {
      if (!response.headersSent) send(response, 500, { error: { _tag: 'InternalError' } });
      else response.end();
    });
  });
  server.listen(config.port, '127.0.0.1');
  return server;
}
