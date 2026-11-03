import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registeredBrowser } from '../support/client.js';
import { startAiHost } from '../support/ai-host.js';
import { useTestApp } from '../support/test-app.js';

let host: Awaited<ReturnType<typeof startAiHost>> | undefined;
beforeAll(async () => {
  host = await startAiHost();
}, 90_000);
afterAll(() => host?.stop());

const app = useTestApp({ aiHost: () => ({ url: host?.url ?? '', token: host?.token ?? null }) });

type Provider = {
  instanceId: string;
  driver: string;
  enabled: boolean;
  status: string;
  models: unknown[];
  setup?: { canAuthenticate?: boolean };
};
const providersOf = async (browser: Awaited<ReturnType<typeof registeredBrowser>>['browser']) =>
  (await browser.get('/api/providers/state')).json().providers as Provider[];

async function waitFor(check: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await check()) return;
    await new Promise((wait) => setTimeout(wait, 250));
  }
  throw new Error('condition not met in time');
}

describe('the AI providers kit through QBank (DEC-30)', () => {
  it('lists every driver with status and models, only for a signed-in account', async () => {
    const anonymous = await app().inject({ method: 'GET', url: '/api/providers/state' });
    expect(anonymous.statusCode).toBe(401);
    const { browser } = await registeredBrowser(app());
    const providers = await providersOf(browser);
    expect(providers.map((p) => p.driver)).toEqual(
      expect.arrayContaining([
        'codex',
        'claudeAgent',
        'cursor',
        'grok',
        'opencode',
        'antigravity',
        'kiro',
        'pi',
      ]),
    );
    expect(providers.find((p) => p.driver === 'claudeAgent')?.models.length).toBeGreaterThan(5);
  });

  it('adds or edits an instance as a settings write, checked with the kit schemas', async () => {
    const { browser } = await registeredBrowser(app());
    const enable = {
      operation: 'upsert',
      instanceId: 'cursor',
      instance: { driver: 'cursor', enabled: true },
    };
    const saved = await browser.post('/api/providers/rpc/server.updateSettings', {
      patch: {},
      providerInstanceMutation: enable,
    });
    expect(saved.statusCode).toBe(200);
    expect(
      (await browser.post('/api/providers/rpc/server.updateSettings', { patch: 5 })).statusCode,
    ).toBe(400);
    expect((await browser.post('/api/providers/rpc/terminal.open', {})).statusCode).toBe(404);
  });
});

describe('subscription sign-in through the kit (DEC-30)', () => {
  it('starts a ChatGPT sign-in owned by the account, and cancels it', async () => {
    const { browser } = await registeredBrowser(app());
    const managed = { driver: 'codex', enabled: true, config: { setupMode: 'managed' } };
    await browser.post('/api/providers/rpc/server.updateSettings', {
      patch: {},
      providerInstanceMutation: { operation: 'upsert', instanceId: 'codex', instance: managed },
    });
    // The kit applies a settings write on its watcher, so wait until sign-in is offered.
    await waitFor(async () => {
      const codex = (await browser.get('/api/providers/state'))
        .json()
        .providers.find((p: Provider) => p.instanceId === 'codex');
      return codex?.setup?.canAuthenticate === true;
    });
    const started = (
      await browser.post('/api/providers/rpc/provider.auth.start', {
        instanceId: 'codex',
        callbackMode: 'client',
      })
    ).json();
    expect(started.methods.map((m: { id: string }) => m.id)).toContain('chatgpt');
    const cancelled = await browser.post('/api/providers/rpc/provider.auth.cancel', {
      instanceId: 'codex',
      flowId: started.flowId,
    });
    expect(cancelled.json().phase).toBe('cancelled');
  });
});
