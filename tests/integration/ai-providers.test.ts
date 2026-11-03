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

describe.each(['openai_compatible', 'anthropic'] as const)(
  'your own %s provider (M2.3)',
  (kind) => {
    const connection = () => ({
      kind,
      baseUrl: kind === 'anthropic' ? fake().anthropicUrl : fake().url,
    });

    it('lists the models a key may use, checks readiness and reads a sample question', async () => {
      const { browser: owner } = await registeredBrowser(app());
      expect((await owner.get('/api/ai/providers')).json()).toEqual({ providers: [] });
      const listed = await owner.post('/api/ai/models', {
        ...connection(),
        apiKey: FAKE_KEYS.valid,
      });
      expect(listed.json()).toEqual({
        status: 'ready',
        models: Object.values(FAKE_MODELS),
      });
      const refused = await owner.post('/api/ai/models', {
        ...connection(),
        apiKey: 'sk-wrong-key-999',
      });
      expect(refused.json()).toEqual({ status: 'invalid_key', models: [] });

      const created = await owner.post('/api/ai/providers', external(connection()));
      const provider = created.json();
      expect(provider).toMatchObject({
        kind,
        isDefault: true,
        keyHint: '••••0001',
        inputPrice: null,
      });
      const check = (await owner.post(`/api/ai/providers/${provider.id}/check`)).json();
      expect(check.readiness.status).toBe('ready');
    });

    it('runs the trial task and rejects output that is not the requested structure', async () => {
      const { owner, id } = await ownerWithProvider(connection());
      const trial = (await owner.post(`/api/ai/providers/${id}/trial`)).json();
      expect(trial.outcome).toBe('ok');
      expect(trial.question).toMatchObject({
        answer: 'B',
        options: expect.arrayContaining(['Hyperkalemia']),
      });
      const broken = await ownerWithProvider({ ...connection(), model: FAKE_MODELS.broken });
      const bad = (await broken.owner.post(`/api/ai/providers/${broken.id}/trial`)).json();
      expect(bad).toMatchObject({ outcome: 'invalid_output', question: null });
    });
  },
);

describe.each(['openai_compatible', 'anthropic'] as const)('%s refusals (FR-08-011)', (kind) => {
  const baseUrl = () => (kind === 'anthropic' ? fake().anthropicUrl : fake().url);
  it.each([
    [FAKE_KEYS.noQuota, FAKE_MODELS.good, 'no_quota'],
    [FAKE_KEYS.forbidden, FAKE_MODELS.good, 'no_permission'],
    [FAKE_KEYS.valid, 'missing-model', 'model_missing'],
  ])('key %s with model %s → %s', async (apiKey, model, status) => {
    const { owner, id } = await ownerWithProvider({ kind, baseUrl: baseUrl(), apiKey, model });
    expect((await owner.post(`/api/ai/providers/${id}/check`)).json().readiness.status).toBe(
      status,
    );
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

  it("the Claude API always needs the user's own key, never this server's credentials", async () => {
    const { browser: owner } = await registeredBrowser(app());
    const claude = { kind: 'anthropic', baseUrl: fake().anthropicUrl };
    const keyless: Record<string, unknown> = external(claude);
    delete keyless['apiKey'];
    const created = await owner.post('/api/ai/providers', keyless);
    expect(created.statusCode).toBe(400);
    expect(created.json().error.fields).toEqual({ apiKey: 'required' });
    expect((await owner.post('/api/ai/models', claude)).statusCode).toBe(400);
    const saved = await ownerWithProvider(claude);
    const removed = await saved.owner.patch(`/api/ai/providers/${saved.id}`, { apiKey: null });
    expect(removed.statusCode).toBe(400);
    expect(removed.json().error.fields).toEqual({ apiKey: 'required' });
    const serverKeys = [
      process.env['ANTHROPIC_API_KEY'],
      process.env['ANTHROPIC_AUTH_TOKEN'],
    ].filter(Boolean);
    expect(
      fake().calls.filter((call) =>
        serverKeys.some((key) => call.authorization?.includes(key ?? '')),
      ),
    ).toEqual([]);
  });

  it('there is no operator-run "local" connection any more', async () => {
    const { browser: owner } = await registeredBrowser(app());
    const local = await owner.post('/api/ai/providers', external({ kind: 'local' }));
    expect(local.statusCode).toBe(400);
  });
});

describe('readiness before costly work (FR-08-011, UAT-084)', () => {
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
