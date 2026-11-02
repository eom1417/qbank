import { describe, expect, it } from 'vitest';
import { FAKE_KEYS, FAKE_MODELS, useAppWithFakeAi } from '../support/fake-ai-server.js';
import { registeredBrowser } from '../support/client.js';

const { app, fake } = useAppWithFakeAi();

const external = (overrides: Record<string, unknown> = {}) => ({
  kind: 'openai_compatible',
  label: 'My provider',
  model: FAKE_MODELS.good,
  baseUrl: fake().url,
  apiKey: FAKE_KEYS.valid,
  acknowledgeDisclosure: true,
  ...overrides,
});

async function ownerWithProvider(overrides: Record<string, unknown> = {}) {
  const { browser } = await registeredBrowser(app());
  const provider = (await browser.post('/api/ai/providers', external(overrides))).json();
  return { owner: browser, provider, id: provider.id as string };
}

const callsWith = (key: string) => fake().calls.filter((c) => c.authorization === `Bearer ${key}`);

describe('local provider (M2.3, DEC-28)', () => {
  it('connects to the operator server without a key, checks it and reads a sample question', async () => {
    const { browser: owner } = await registeredBrowser(app());
    const list = (await owner.get('/api/ai/providers')).json();
    expect(list).toEqual({ providers: [], local: { available: true, baseUrl: fake().url } });

    const created = await owner.post('/api/ai/providers', {
      kind: 'local',
      label: 'This server',
      model: FAKE_MODELS.good,
    });
    expect(created.statusCode).toBe(201);
    const local = created.json();
    expect(local).toMatchObject({ isDefault: true, keyHint: null, baseUrl: null, inputPrice: 0 });
    expect(local.readiness).toEqual({ status: 'unchecked', checkedAt: null });

    const check = (await owner.post(`/api/ai/providers/${local.id}/check`)).json();
    expect(check.readiness.status).toBe('ready');
    const trial = (await owner.post(`/api/ai/providers/${local.id}/trial`)).json();
    expect(trial.outcome).toBe('ok');
    expect(trial.question).toMatchObject({
      answer: 'B',
      options: expect.arrayContaining(['Hyperkalemia']),
    });
  });

  it('rejects model output that is not the requested structure', async () => {
    const { owner, id } = await ownerWithProvider({ model: FAKE_MODELS.broken });
    const trial = (await owner.post(`/api/ai/providers/${id}/trial`)).json();
    expect(trial).toMatchObject({ outcome: 'invalid_output', question: null });
  });
});

describe('BYOK keys (FR-08-009, FR-22-002, UI-24)', () => {
  it('never returns or stores the key in clear, and uses it only for its own calls', async () => {
    const { owner, provider, id } = await ownerWithProvider();
    expect(provider.keyHint).toBe('••••0001');
    expect(JSON.stringify((await owner.get('/api/ai/providers')).json())).not.toContain(
      FAKE_KEYS.valid,
    );
    const row = await app
      .db()
      .selectFrom('ai_provider')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row.key_ciphertext).not.toContain(FAKE_KEYS.valid);

    const before = callsWith(FAKE_KEYS.valid).length;
    expect((await owner.post(`/api/ai/providers/${id}/check`)).json().readiness.status).toBe(
      'ready',
    );
    expect(callsWith(FAKE_KEYS.valid).length).toBe(before + 1);
  });

  it('changing the key resets readiness and the next check uses the new key', async () => {
    const { owner, id } = await ownerWithProvider({ apiKey: 'sk-wrong-key-999' });
    expect((await owner.post(`/api/ai/providers/${id}/check`)).json().readiness.status).toBe(
      'invalid_key',
    );
    const changed = (
      await owner.patch(`/api/ai/providers/${id}`, { apiKey: FAKE_KEYS.valid })
    ).json();
    expect(changed.readiness).toEqual({ status: 'unchecked', checkedAt: null });
    expect((await owner.post(`/api/ai/providers/${id}/check`)).json().readiness.status).toBe(
      'ready',
    );

    const removed = (await owner.patch(`/api/ai/providers/${id}`, { apiKey: null })).json();
    expect(removed.keyHint).toBeNull();
  });
});

describe('connection input rules', () => {
  it('requires acknowledging that content goes to an external provider (FR-20-003)', async () => {
    const { browser: owner } = await registeredBrowser(app());
    const unacknowledged: Record<string, unknown> = external();
    delete unacknowledged['acknowledgeDisclosure'];
    expect((await owner.post('/api/ai/providers', unacknowledged)).statusCode).toBe(400);
    expect((await owner.post('/api/ai/providers', external({ apiKey: 'short' }))).statusCode).toBe(
      400,
    );
  });

  it('a local connection takes no key or URL', async () => {
    const { browser: owner } = await registeredBrowser(app());
    const local = (
      await owner.post('/api/ai/providers', { kind: 'local', label: 'L', model: 'm' })
    ).json();
    const keyed = await owner.patch(`/api/ai/providers/${local.id}`, { apiKey: FAKE_KEYS.valid });
    expect(keyed.statusCode).toBe(400);
    expect(keyed.json().error.fields).toEqual({ apiKey: 'unavailable' });
  });
});

describe('readiness before costly work (FR-08-011, UAT-084)', () => {
  it.each([
    [FAKE_KEYS.noQuota, FAKE_MODELS.good, 'no_quota'],
    [FAKE_KEYS.forbidden, FAKE_MODELS.good, 'no_permission'],
    [FAKE_KEYS.valid, 'missing-model', 'model_missing'],
  ])('key %s with model %s → %s', async (apiKey, model, status) => {
    const { owner, id } = await ownerWithProvider({ apiKey, model });
    expect((await owner.post(`/api/ai/providers/${id}/check`)).json().readiness.status).toBe(
      status,
    );
  });

  it('reports an unreachable server as such', async () => {
    const { owner, id } = await ownerWithProvider({ baseUrl: 'http://127.0.0.1:9/v1' });
    expect((await owner.post(`/api/ai/providers/${id}/check`)).json().readiness.status).toBe(
      'unreachable',
    );
  });

  it('a known bad key is not called again by a trial or an immediate re-check', async () => {
    const badKey = 'sk-expired-key-777';
    const { owner, id } = await ownerWithProvider({ apiKey: badKey });
    await owner.post(`/api/ai/providers/${id}/check`);
    const spent = callsWith(badKey).length;
    const again = (await owner.post(`/api/ai/providers/${id}/check`)).json();
    expect(again).toMatchObject({ fromCache: true, readiness: { status: 'invalid_key' } });
    const trial = (await owner.post(`/api/ai/providers/${id}/trial`)).json();
    expect(trial).toMatchObject({ outcome: 'not_ready', readiness: { status: 'invalid_key' } });
    expect(callsWith(badKey).length).toBe(spent);
  });
});
