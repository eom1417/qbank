import { describe, expect, it } from 'vitest';
import { FAKE_KEYS, FAKE_MODELS, useAppWithFakeAi } from '../support/fake-ai-server.js';
import { createClient, registeredBrowser } from '../support/client.js';

const { app, fake } = useAppWithFakeAi();

type Browser = ReturnType<typeof createClient>;

async function addProvider(owner: Browser, label: string, apiKey: string, prices = {}) {
  const body = {
    kind: 'openai_compatible',
    label,
    model: FAKE_MODELS.good,
    baseUrl: fake().url,
    apiKey,
    acknowledgeDisclosure: true,
    ...prices,
  };
  return (await owner.post('/api/ai/providers', body)).json() as { id: string; isDefault: boolean };
}

const estimate = async (owner: Browser, pages: number) =>
  (await owner.post('/api/ai/estimate', { pages })).json();

describe('two accounts never share a key (FR-20-002)', () => {
  it("cannot read, use, change or delete another account's connection", async () => {
    const { browser: owner } = await registeredBrowser(app());
    const { id } = await addProvider(owner, 'Mine', FAKE_KEYS.valid);
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.get('/api/ai/providers')).json().providers).toEqual([]);
    for (const path of ['check', 'trial', 'default']) {
      expect((await stranger.post(`/api/ai/providers/${id}/${path}`)).statusCode).toBe(404);
    }
    expect((await stranger.patch(`/api/ai/providers/${id}`, { label: 'x' })).statusCode).toBe(404);
    expect((await stranger.delete(`/api/ai/providers/${id}`)).statusCode).toBe(404);
    expect((await owner.get('/api/ai/providers')).json().providers).toHaveLength(1);
  });

  it("a sealed key copied into another account's row does not open", async () => {
    const { browser: owner } = await registeredBrowser(app());
    const victim = await addProvider(owner, 'Victim', FAKE_KEYS.valid);
    const { browser: thief } = await registeredBrowser(app());
    const own = await addProvider(thief, 'Thief', 'sk-thief-own-key-55');
    const db = app.db();
    const sealed = await db
      .selectFrom('ai_provider')
      .select('key_ciphertext')
      .where('id', '=', victim.id)
      .executeTakeFirstOrThrow();
    await db
      .updateTable('ai_provider')
      .set({ key_ciphertext: sealed.key_ciphertext })
      .where('id', '=', own.id)
      .execute();

    const before = fake().calls.length;
    const check = (await thief.post(`/api/ai/providers/${own.id}/check`)).json();
    expect(check.readiness.status).toBe('invalid_key');
    expect(fake().calls.length).toBe(before);
  });

  it('requires a session for every AI endpoint', async () => {
    const anonymous = createClient(app());
    expect((await anonymous.get('/api/ai/providers')).statusCode).toBe(401);
    expect((await anonymous.post('/api/ai/estimate', { pages: 1 })).statusCode).toBe(401);
  });
});

describe('default provider (FR-08-010)', () => {
  it('the next task uses the provider chosen as default; deleting it promotes the other', async () => {
    const { browser: owner } = await registeredBrowser(app());
    const first = await addProvider(owner, 'First', FAKE_KEYS.valid);
    const second = await addProvider(owner, 'Second', FAKE_KEYS.valid);
    expect([first.isDefault, second.isDefault]).toEqual([true, false]);
    expect((await estimate(owner, 1)).provider.label).toBe('First');

    expect((await owner.post(`/api/ai/providers/${second.id}/default`)).statusCode).toBe(204);
    expect((await estimate(owner, 1)).provider.label).toBe('Second');

    expect((await owner.delete(`/api/ai/providers/${second.id}`)).statusCode).toBe(204);
    expect((await estimate(owner, 1)).provider.label).toBe('First');
    await owner.delete(`/api/ai/providers/${first.id}`);
    expect(await estimate(owner, 1)).toMatchObject({ provider: null, needsApproval: false });
  });
});

describe('cost limits (FR-08-012, FR-22-008, DEC-18)', () => {
  it('starts with honest defaults and saves the user limits', async () => {
    const { browser: owner } = await registeredBrowser(app());
    expect((await owner.get('/api/ai/settings')).json()).toEqual({
      costLimitUsd: null,
      approvalPages: 200,
    });
    const saved = await owner.patch('/api/ai/settings', { costLimitUsd: 0.05 });
    expect(saved.json()).toEqual({ costLimitUsd: 0.05, approvalPages: 200 });
    expect((await owner.patch('/api/ai/settings', { costLimitUsd: -1 })).statusCode).toBe(400);
    expect((await owner.patch('/api/ai/settings', { approvalPages: 0 })).statusCode).toBe(400);
    expect((await owner.patch('/api/ai/settings', {})).statusCode).toBe(400);
  });

  it('asks for approval only when a task passes a limit, and never invents a price', async () => {
    const { browser: owner } = await registeredBrowser(app());
    await addProvider(owner, 'Priced', FAKE_KEYS.valid, { inputPrice: 2, outputPrice: 8 });
    await owner.patch('/api/ai/settings', { costLimitUsd: 0.05, approvalPages: 300 });
    expect(await estimate(owner, 5)).toMatchObject({
      costUsd: 0.043,
      needsApproval: false,
      reasons: [],
    });
    expect((await estimate(owner, 6)).reasons).toEqual(['over_cost_limit']);
    await owner.patch('/api/ai/settings', { costLimitUsd: null });
    expect((await estimate(owner, 301)).reasons).toEqual(['over_page_limit']);

    const { browser: unpriced } = await registeredBrowser(app());
    await addProvider(unpriced, 'Unpriced', FAKE_KEYS.valid);
    await unpriced.patch('/api/ai/settings', { costLimitUsd: 1 });
    expect(await estimate(unpriced, 1)).toMatchObject({ costUsd: null, reasons: ['cost_unknown'] });
    expect((await unpriced.post('/api/ai/estimate', { pages: 2, imagePages: 3 })).statusCode).toBe(
      400,
    );
  });
});
