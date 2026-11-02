import { describe, expect, it } from 'vitest';
import { registeredBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

// No QBANK_LOCAL_AI_URL configured: the account works fully without any AI (FR-08-013).
const app = useTestApp();

describe('no local AI server and no key (FR-08-013)', () => {
  it('reports the local server as unavailable and refuses to connect to it', async () => {
    const { browser: owner } = await registeredBrowser(app());
    const list = (await owner.get('/api/ai/providers')).json();
    expect(list.local).toEqual({ available: false, baseUrl: null });
    const local = await owner.post('/api/ai/providers', { kind: 'local', label: 'L', model: 'm' });
    expect(local.statusCode).toBe(400);
    expect(local.json().error.fields).toEqual({ kind: 'unavailable' });
  });

  it('an estimate without a provider names none and asks nothing', async () => {
    const { browser: owner } = await registeredBrowser(app());
    expect((await owner.post('/api/ai/estimate', { pages: 999 })).json()).toMatchObject({
      provider: null,
      needsApproval: false,
    });
    expect((await owner.get('/api/banks')).statusCode).toBe(200);
  });
});
