import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll } from 'vitest';

/** The provider instances the fake host lists; any other instance id is unknown to it. */
export const FAKE_INSTANCES = {
  /** Reports option A as marked by hand (the extraction AI layer). */
  vision: 'fake-vision',
  /** Signed out: every question fails as the kit's `provider_error`. */
  refusing: 'fake-refusing',
  /** Turned off in the kit: never asked. */
  disabled: 'fake-disabled',
  /** Fixes the misread unit of the review tests' question (M7.4). */
  fixer: 'fake-fixer',
  /** Explains an answered study question (M9.4). */
  explainer: 'fake-explainer',
} as const;

const EXPLAIN_ANSWER = JSON.stringify({
  explanation: 'B is right because the keyed finding fits; the others do not.',
  options: [{ letter: 'A', why: 'Does not fit.' }],
  confidence: 'medium',
  caveats: 'Check your textbook.',
});

/** The fixer's reply: the unit read right, with words copied from the page. */
const FIX_ANSWER = JSON.stringify({
  stem: 'Serum potassium is 7.2 mmol/L. Which ECG change is typical?',
  options: ['A', 'B', 'C', 'D'].map((letter) => ({ letter, text: `Option ${letter}` })),
  reason: 'The unit was misread.',
  evidence: 'potassium is 7.2 mmol/L',
});

const FAKE_HOST_TOKEN = 'fake-ai-host-token-0123456789abcdef';

const MARK_ANSWER = JSON.stringify({ marked: 'A', mark: 'circle', confident: true });

interface Ask {
  ownerSession: string | undefined;
  body: { instanceId?: string; model?: string; prompt?: string; imagePngBase64?: string };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of request) text += String(chunk);
  return text ? JSON.parse(text) : null;
}

function respond(response: ServerResponse, status: number, body: object) {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

const instance = (instanceId: string, enabled: boolean) => ({
  instanceId,
  driver: 'claudeAgent',
  enabled,
  supportsTextGeneration: true,
  auth: { status: 'authenticated' },
  models: [
    { slug: 'fake-large', name: 'Fake Large', isDefault: true },
    { slug: 'fake-small', name: 'Fake Small' },
  ],
});

/**
 * A local stand-in for ai-host (the T3 AI Providers Kit) speaking its `/state` and `/ask`
 * routes: no CLI, no account, deterministic. `refusing` is mutable so a test can "sign in".
 */
export async function startFakeAiHost() {
  const asks: Ask[] = [];
  const refusing = new Set<string>([FAKE_INSTANCES.refusing]);
  const answer = (body: Ask['body']): [number, object] => {
    if (refusing.has(body.instanceId ?? ''))
      return [
        422,
        { error: { _tag: 'AskFailed', reason: 'provider_error', detail: 'signed out' } },
      ];
    const replies: Record<string, string> = {
      [FAKE_INSTANCES.fixer]: FIX_ANSWER,
      [FAKE_INSTANCES.explainer]: EXPLAIN_ANSWER,
    };
    const reply = replies[body.instanceId ?? ''] ?? MARK_ANSWER;
    return [200, { text: `Here it is: ${reply}` }];
  };
  const server = createServer((request, response) => {
    void readJson(request).then((body) => {
      if (request.headers.authorization !== `Bearer ${FAKE_HOST_TOKEN}`)
        return respond(response, 401, { error: 'unauthorized' });
      if (request.url === '/state') {
        const providers = [
          instance(FAKE_INSTANCES.vision, true),
          instance(FAKE_INSTANCES.refusing, true),
          instance(FAKE_INSTANCES.disabled, false),
          instance(FAKE_INSTANCES.fixer, true),
          instance(FAKE_INSTANCES.explainer, true),
        ];
        return respond(response, 200, { providers, settings: { providerInstances: {} } });
      }
      if (request.url !== '/ask') return respond(response, 404, { error: 'not_found' });
      const ownerSession = request.headers['x-owner-session'];
      asks.push({ ownerSession: ownerSession as string | undefined, body: body as Ask['body'] });
      respond(response, ...answer(body as Ask['body']));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    settings: { url: `http://127.0.0.1:${port}`, token: FAKE_HOST_TOKEN },
    asks,
    refusing,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * A fake AI host for the current suite file. Call it before `useTestApp`, so it is listening
 * when the app reads its address: `useTestApp({ aiHost: () => fake().settings })`.
 */
export function useFakeAiHost() {
  let fake: Awaited<ReturnType<typeof startFakeAiHost>> | undefined;
  beforeAll(async () => {
    fake = await startFakeAiHost();
  });
  afterAll(() => fake?.close());
  return () => {
    if (!fake) throw new Error('fake AI host not started');
    return fake;
  };
}
