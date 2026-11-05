import { describe, expect, it } from 'vitest';
import { pairedBrowser, registeredBrowser } from '../support/client.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { ORIGIN, useTestApp } from '../support/test-app.js';

const fakeHost = useFakeAiHost();
const local = useTestApp({ local: true, aiHost: () => fakeHost().settings });
const accounts = useTestApp({ aiHost: () => fakeHost().settings });

describe('testing a model with one real turn (POST /api/providers/test)', () => {
  it('reports a model that answers as ready, on the chosen model', async () => {
    const { browser } = await pairedBrowser(local());
    const reply = await browser.post('/api/providers/test', {
      instanceId: FAKE_INSTANCES.pinger,
      model: 'fake-small',
    });
    expect(reply.statusCode).toBe(200);
    expect(reply.json()).toEqual({ status: 'ready' });
    expect(fakeHost().asks.at(-1)?.body.model).toBe('fake-small');
  });

  it('reports a model that runs but replies in the wrong shape', async () => {
    const { browser } = await pairedBrowser(local());
    const reply = await browser.post('/api/providers/test', { instanceId: FAKE_INSTANCES.vision });
    expect(reply.json()).toEqual({ status: 'invalid_output' });
  });

  it('says why a model does not run, and rejects a malformed target', async () => {
    const { browser } = await pairedBrowser(local());
    const refused = await browser.post('/api/providers/test', {
      instanceId: FAKE_INSTANCES.refusing,
    });
    expect(refused.json()).toEqual({ status: 'invalid_key' });
    const bad = await browser.post('/api/providers/test', { instanceId: '../x' });
    expect(bad.statusCode).toBe(400);
  });

  it('needs a paired browser', async () => {
    const anonymous = await local().inject({
      method: 'POST',
      url: '/api/providers/test',
      headers: { origin: ORIGIN, 'x-forwarded-for': '203.0.113.9' },
    });
    expect(anonymous.statusCode).toBe(401);
  });

  it("is not offered in accounts mode, where the subscription is not the account's", async () => {
    const { browser } = await registeredBrowser(accounts());
    const reply = await browser.post('/api/providers/test', { instanceId: FAKE_INSTANCES.pinger });
    expect(reply.statusCode).toBe(404);
  });
});
