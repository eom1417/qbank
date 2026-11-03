import { describe, expect, it } from 'vitest';
import { createClient, registeredBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

// Subscription accounts through the official CLIs (here: tests/fixtures/fake-cli, which fail on
// purpose if any server secret reaches them). The tests run with the server's own secrets set.
process.env['QBANK_MASTER_KEY'] = 'must-not-reach-the-cli';
const app = useTestApp();

type Browser = ReturnType<typeof createClient>;

async function waitFor(owner: Browser, id: string, done = ['completed', 'failed', 'cancelled']) {
  for (let i = 0; i < 100; i++) {
    const login = (await owner.get(`/api/ai/accounts/login/${id}`)).json();
    if (done.includes(login.status)) return login;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('login did not finish');
}

async function signInClaude(owner: Browser, code: string) {
  const started = await owner.post('/api/ai/accounts/login', {
    provider: 'claude',
    acknowledgeDisclosure: true,
  });
  expect(started.statusCode).toBe(201);
  const login = started.json();
  expect(login).toMatchObject({ provider: 'claude', status: 'awaiting_code', deviceCode: null });
  expect(login.authUrl).toMatch(/^https:\/\/claude\.com\/cai\/oauth\/authorize\?/);
  expect(
    (await owner.post(`/api/ai/accounts/login/${login.id}/code`, { code })).json().status,
  ).toBe('waiting');
  return waitFor(owner, login.id);
}

const sealedOf = async (id: string) =>
  (
    await app
      .db()
      .selectFrom('ai_provider')
      .select('key_ciphertext')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
  ).key_ciphertext;

describe('Claude subscription account (official CLI sign-in)', () => {
  it('signs in with the pasted code, stores the login sealed, and runs tasks on it', async () => {
    const { browser: owner } = await registeredBrowser(app());
    const done = await signInClaude(owner, 'good-code');
    expect(done).toMatchObject({ status: 'completed', error: null });
    const [connection] = (await owner.get('/api/ai/providers')).json().providers;
    expect(connection).toMatchObject({
      id: done.providerId,
      kind: 'claude_account',
      baseUrl: null,
      keyHint: null,
      model: 'sonnet',
      isDefault: true,
      account: { email: 'learner@example.test', plan: 'max' },
      readiness: { status: 'ready' },
    });
    const before = await sealedOf(connection.id);
    expect(before).not.toContain('at-1');

    const trial = (await owner.post(`/api/ai/providers/${connection.id}/trial`)).json();
    expect(trial).toMatchObject({ outcome: 'ok', question: { answer: 'B' } });
    // The CLI refreshed its token during the run; the new login was sealed again.
    expect(await sealedOf(connection.id)).not.toBe(before);
    expect((await owner.post(`/api/ai/providers/${connection.id}/trial`)).json().outcome).toBe(
      'ok',
    );
    expect((await owner.post('/api/ai/estimate', { pages: 50 })).json()).toMatchObject({
      costUsd: 0,
    });
  });

  it('a rejected code creates nothing', async () => {
    const { browser: owner } = await registeredBrowser(app());
    expect(await signInClaude(owner, 'wrong-code')).toMatchObject({
      status: 'failed',
      error: 'login_failed',
      providerId: null,
    });
    expect((await owner.get('/api/ai/providers')).json().providers).toEqual([]);
  });

  it('a login the CLI does not accept fails, and a limited account is reported', async () => {
    const { browser: owner } = await registeredBrowser(app());
    expect((await signInClaude(owner, 'revoked-code')).status).toBe('failed');
    const limited = await signInClaude(owner, 'limited-code');
    const trial = (await owner.post(`/api/ai/providers/${limited.providerId}/trial`)).json();
    expect(trial).toMatchObject({ outcome: 'not_ready', readiness: { status: 'rate_limited' } });
  });
});

describe('ChatGPT (Codex) subscription account (device sign-in)', () => {
  it('shows the link and one-time code, then saves the account when approved', async () => {
    const { browser: owner } = await registeredBrowser(app());
    const started = (
      await owner.post('/api/ai/accounts/login', { provider: 'codex', acknowledgeDisclosure: true })
    ).json();
    expect(started).toMatchObject({
      status: 'waiting',
      authUrl: 'https://auth.openai.com/codex/device',
      deviceCode: 'ABCD-EFGH1',
    });
    const done = await waitFor(owner, started.id);
    expect(done.status).toBe('completed');
    const connection = (await owner.get('/api/ai/providers')).json().providers[0];
    expect(connection).toMatchObject({
      kind: 'codex_account',
      model: 'default',
      account: { email: 'learner@example.test', plan: 'plus' },
    });
    expect(
      (await owner.post(`/api/ai/providers/${connection.id}/check`)).json().readiness.status,
    ).toBe('ready');
    expect((await owner.post(`/api/ai/providers/${connection.id}/trial`)).json()).toMatchObject({
      outcome: 'ok',
    });
  });
});

describe('account sign-in rules', () => {
  it('needs the disclosure, keeps sign-ins private, and accounts take no key or address', async () => {
    const { browser: owner } = await registeredBrowser(app());
    expect((await owner.post('/api/ai/accounts/login', { provider: 'claude' })).statusCode).toBe(
      400,
    );
    const started = (
      await owner.post('/api/ai/accounts/login', { provider: 'codex', acknowledgeDisclosure: true })
    ).json();
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.get(`/api/ai/accounts/login/${started.id}`)).statusCode).toBe(404);
    expect((await stranger.delete(`/api/ai/accounts/login/${started.id}`)).statusCode).toBe(404);
    expect((await owner.delete(`/api/ai/accounts/login/${started.id}`)).statusCode).toBe(204);
    expect((await owner.get(`/api/ai/accounts/login/${started.id}`)).json().status).toBe(
      'cancelled',
    );

    const done = await signInClaude(owner, 'good-code');
    const patch = await owner.patch(`/api/ai/providers/${done.providerId}`, {
      apiKey: 'sk-something-long',
    });
    expect(patch.statusCode).toBe(400);
    expect(
      (await owner.patch(`/api/ai/providers/${done.providerId}`, { model: 'opus' })).json().model,
    ).toBe('opus');
  });
});
