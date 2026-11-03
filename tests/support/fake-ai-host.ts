import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** The provider instances the fake host lists; any other instance id is unknown to it. */
export const FAKE_INSTANCES = {
  /** Reports option A as marked by hand (the extraction AI layer). */
  vision: 'fake-vision',
  /** Signed out: every question fails as the kit's `provider_error`. */
  refusing: 'fake-refusing',
  /** Turned off in the kit: never asked. */
  disabled: 'fake-disabled',
} as const;

const FAKE_HOST_TOKEN = 'fake-ai-host-token-0123456789abcdef';

const MARK_ANSWER = JSON.stringify({ marked: 'A', mark: 'circle', confident: true });

interface Ask {
  ownerSession: string | undefined;
  body: { instanceId?: string; prompt?: string; imagePngBase64?: string };
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
    return [200, { text: `Here it is: ${MARK_ANSWER}` }];
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
