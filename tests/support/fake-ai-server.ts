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

/** `tiny-model` answers correctly; `broken-model` returns text that is not the requested JSON. */
export const FAKE_MODELS = { good: 'tiny-model', broken: 'broken-model' } as const;

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

function refusal(key: string | undefined): [number, object] | null {
  if (key === undefined || key === FAKE_KEYS.valid) return null;
  if (key === FAKE_KEYS.noQuota) return [429, { error: { code: 'insufficient_quota' } }];
  if (key === FAKE_KEYS.forbidden) return [403, { error: { code: 'permission_denied' } }];
  return [401, { error: { code: 'invalid_api_key' } }];
}

function completion(body: { model?: string }) {
  const content = body.model === FAKE_MODELS.broken ? 'Sure! The answer is B.' : GOOD_ANSWER;
  return {
    choices: [{ message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 120, completion_tokens: 40 },
  };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of request) text += String(chunk);
  return text ? JSON.parse(text) : null;
}

function respond(response: ServerResponse, status: number, body: object) {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

/** A local stand-in for an OpenAI-compatible server (Ollama, llama.cpp, a cloud API). */
export async function startFakeAiServer(port = 0) {
  const calls: Call[] = [];
  const server = createServer((request, response) => {
    void readJson(request).then((body) => {
      const path = request.url ?? '';
      const authorization = request.headers.authorization;
      calls.push({ path, authorization, body });
      const refused = refusal(authorization?.replace(/^Bearer /, ''));
      if (refused) return respond(response, ...refused);
      if (path.endsWith('/models')) {
        return respond(response, 200, { data: Object.values(FAKE_MODELS).map((id) => ({ id })) });
      }
      if (path.endsWith('/chat/completions')) return respond(response, 200, completion(body ?? {}));
      return respond(response, 404, { error: { code: 'not_found' } });
    });
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const { port: bound } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${bound}/v1`,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** A test app whose local AI server is a fresh fake provider, for the current suite file. */
export function useAppWithFakeAi() {
  let fake: Awaited<ReturnType<typeof startFakeAiServer>> | undefined;
  const started = () => {
    if (!fake) throw new Error('fake AI server not started');
    return fake;
  };
  beforeAll(async () => {
    fake = await startFakeAiServer();
  });
  afterAll(() => fake?.close());
  return { app: useTestApp({ localAiUrl: () => started().url }), fake: started };
}
