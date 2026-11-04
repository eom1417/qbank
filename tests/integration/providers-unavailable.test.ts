import { describe, expect, it } from 'vitest';
import { registeredBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

const app = useTestApp();

describe('without the AI host', () => {
  it('says plainly that the AI service is not running', async () => {
    const { browser } = await registeredBrowser(app());
    const state = await browser.get('/api/providers/state');
    expect([state.statusCode, state.json().error.code]).toEqual([503, 'ai_host_unavailable']);
  });

  it('lets an account look at the shared AI, never change it (accounts mode, M17.4)', async () => {
    const { browser } = await registeredBrowser(app());
    expect((await browser.post('/api/providers/rpc/server.refreshProviders', {})).statusCode).toBe(
      503,
    );
    for (const method of [
      'server.updateSettings',
      'server.updateProvider',
      'provider.install.start',
    ])
      expect((await browser.post(`/api/providers/rpc/${method}`, {})).statusCode).toBe(404);
    expect((await browser.get('/api/providers/events/provider.auth.subscribe')).statusCode).toBe(
      404,
    );
    expect(
      (await browser.post('/api/providers/login', { method: 'codex.chatgpt' })).statusCode,
    ).toBe(404);
    expect((await browser.post('/api/providers/logout', { provider: 'codex' })).statusCode).toBe(
      404,
    );
  });
});
