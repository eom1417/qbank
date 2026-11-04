import { describe, expect, it } from 'vitest';
import { createClient, registeredBrowser } from '../support/client.js';
import { ORIGIN, useTestApp } from '../support/test-app.js';

// M17.4 findings in accounts mode: reset links and password guessing.
const app = useTestApp();

describe('accounts mode, after the security review (M17.4)', () => {
  it('builds reset links from the configured app, never from the Host or Origin sent', async () => {
    const { payload } = await registeredBrowser(app());
    const forged = await app().inject({
      method: 'POST',
      url: '/api/auth/password-reset/request',
      headers: { host: 'evil.example', origin: 'https://evil.example' },
      payload: { email: payload.email },
    });
    expect(forged.statusCode).toBe(202);
    const outbox = (await createClient(app()).get('/api/dev/outbox')).json();
    const mail = outbox.messages.find((m: { to: string }) => m.to === payload.email);
    expect(mail.text).toContain(`${ORIGIN}/reset-password#token=`);
    expect(mail.text).not.toContain('evil.example');
  });

  it('pauses sign-in for an email after ten wrong passwords, even with the right one', async () => {
    const { payload } = await registeredBrowser(app());
    const signIn = (password: string) =>
      createClient(app()).post('/api/auth/sign-in', { email: payload.email, password });
    for (let i = 0; i < 10; i++)
      expect((await signIn('wrong password value')).statusCode).toBe(401);
    const paused = await signIn(payload.password);
    expect([paused.statusCode, paused.json().error.code]).toEqual([429, 'too_many_attempts']);
  });

  it('sends at most five reset emails an hour to one inbox', async () => {
    const { payload } = await registeredBrowser(app());
    const ask = () =>
      createClient(app()).post('/api/auth/password-reset/request', { email: payload.email });
    for (let i = 0; i < 5; i++) expect((await ask()).statusCode).toBe(202);
    expect((await ask()).statusCode).toBe(429);
  });
});
