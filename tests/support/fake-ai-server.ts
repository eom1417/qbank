import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll } from 'vitest';
import { useTestApp } from './test-app.js';

/** Keys the fake provider understands; any other key is rejected as invalid. */
export const FAKE_KEYS = {
  valid: 'sk-fake-valid-key-0001',
  noQuota: 'sk-fake-no-quota-0002',
  forbidden: 'sk-fake-forbidden-0003',
} as const;

/**
 * `tiny-model` answers correctly; `broken-model` returns text that is not the requested JSON;
 * `vision-model` reports option A as marked by hand (the extraction AI layer).
 */
export const FAKE_MODELS = {
  good: 'tiny-model',
  broken: 'broken-model',
  vision: 'vision-model',
} as const;

const GOOD_ANSWER = JSON.stringify({
  stem: 'Which electrolyte disturbance most typically produces peaked T waves on an ECG?',
  options: ['Hypokalemia', 'Hyperkalemia', 'Hypocalcemia', 'Hypomagnesemia'],
  answer: 'B',
});

interface Call {
  path: string;
  authorization: string | undefined;
  body: unknown;
}

/** OpenAI-style refusals; Anthropic-style ones carry `{ type: 'error', error: { type } }`. */
function refusal(key: string | undefined, anthropic: boolean): [number, object] | null {
  if (key === undefined ? anthropic : key === FAKE_KEYS.valid)
    return key === undefined ? [401, anthropicError('authentication_error')] : null;
  if (key === FAKE_KEYS.noQuota)
    return anthropic
      ? [402, anthropicError('billing_error')]
      : [429, { error: { code: 'insufficient_quota' } }];
  if (key === FAKE_KEYS.forbidden)
    return [
      403,
      anthropic ? anthropicError('permission_error') : { error: { code: 'permission_denied' } },
    ];
  return [
    401,
    anthropic ? anthropicError('authentication_error') : { error: { code: 'invalid_api_key' } },
  ];
}

const anthropicError = (type: string) => ({ type: 'error', error: { type, message: type } });

const MARK_ANSWER = JSON.stringify({ marked: 'A', mark: 'circle', confident: true });

const replyFor = (model: string | undefined) => {
  if (model === FAKE_MODELS.broken) return 'Sure! The answer is B.';
  return model === FAKE_MODELS.vision ? MARK_ANSWER : GOOD_ANSWER;
};

function completion(body: { model?: string }) {
  const content = replyFor(body.model);
  return {
    choices: [{ message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 120, completion_tokens: 40 },
  };
}

function anthropicMessage(body: { model?: string }) {
  const text = replyFor(body.model);
  return {
    id: 'msg_fake',
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 120, output_tokens: 40 },
  };
}

const MODEL_IDS = Object.values(FAKE_MODELS);
const anthropicModels = {
  data: MODEL_IDS.map((id) => ({
    id,
    type: 'model',
    display_name: id,
    created_at: '2026-01-01T00:00:00Z',
  })),
  has_more: false,
  first_id: MODEL_IDS[0],
  last_id: MODEL_IDS[MODEL_IDS.length - 1],
};

async function readJson(request: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of request) text += String(chunk);
  return text ? JSON.parse(text) : null;
}

function respond(response: ServerResponse, status: number, body: object) {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

const keyOf = (request: IncomingMessage) => {
  const header = request.headers['x-api-key'];
  if (typeof header === 'string') return header;
  return request.headers.authorization?.replace(/^Bearer /, '');
};

function route(path: string, body: unknown): [number, object] {
  const anthropic = path.startsWith('/anthropic/');
  if (/\/v1\/models(\?|$)/.test(path))
    return [200, anthropic ? anthropicModels : { data: MODEL_IDS.map((id) => ({ id })) }];
  const request = (body ?? {}) as { model?: string };
  if (anthropic && path.startsWith('/anthropic/v1/messages'))
    return [200, anthropicMessage(request)];
  if (path.endsWith('/chat/completions')) return [200, completion(request)];
  return [404, { error: { code: 'not_found' } }];
}

/**
 * A local stand-in for the providers users connect: OpenAI-compatible APIs under `/openai/v1`
 * and the Anthropic Messages API under `/anthropic`. No network, no cost, deterministic.
 */
export async function startFakeAiServer(port = 0) {
  const calls: Call[] = [];
  const server = createServer((request, response) => {
    void readJson(request).then((body) => {
      const path = request.url ?? '';
      const key = keyOf(request);
      calls.push({ path, authorization: key === undefined ? undefined : `Bearer ${key}`, body });
      const refused = refusal(key, path.startsWith('/anthropic/'));
      respond(response, ...(refused ?? route(path, body)));
    });
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const { port: bound } = server.address() as AddressInfo;
  const root = `http://127.0.0.1:${bound}`;
  return {
    url: `${root}/openai/v1`,
    anthropicUrl: `${root}/anthropic`,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** A test app plus a fresh fake provider, for the current suite file. */
export function useAppWithFakeAi() {
  let fake: Awaited<ReturnType<typeof startFakeAiServer>> | undefined;
  beforeAll(async () => {
    fake = await startFakeAiServer();
  });
  afterAll(() => fake?.close());
  const started = () => {
    if (!fake) throw new Error('fake AI server not started');
    return fake;
  };
  return { app: useTestApp(), fake: started };
}
