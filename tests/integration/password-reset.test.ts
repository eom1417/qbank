import { describe, expect, it } from 'vitest';
import { createClient, registeredBrowser } from '../support/client.js';
import { ORIGIN, useTestApp } from '../support/test-app.js';

const app = useTestApp();

async function latestMailTo(email: string) {
  const outbox = (await createClient(app()).get('/api/dev/outbox')).json();
  return outbox.messages.find((message: { to: string }) => message.to === email);
}

const tokenFrom = (text: string) => /#token=([\w-]+)/.exec(text)?.[1] ?? '';

describe('password reset by e-mail link (UI-02)', () => {
  it('answers the same for unknown and known e-mails, but only mails the real account', async () => {
    const { payload } = await registeredBrowser(app());
    const visitor = createClient(app());
    const unknown = await visitor.post('/api/auth/password-reset/request', {
      email: 'nobody-here@example.test',
    });
    const known = await visitor.post('/api/auth/password-reset/request', { email: payload.email });
    expect(unknown.statusCode).toBe(202);
    expect(known.statusCode).toBe(202);
    expect(unknown.body).toBe(known.body);
    expect(await latestMailTo('nobody-here@example.test')).toBeUndefined();
    const mail = await latestMailTo(payload.email);
    expect(mail.text).toContain(`${ORIGIN}/reset-password#token=`);
    expect(mail.subject).toContain('كلمة المرور');
  });

  it('sets a new password once, signs every device out and refuses a reused link', async () => {
    const { browser, payload } = await registeredBrowser(app());
    await createClient(app()).post('/api/auth/password-reset/request', { email: payload.email });
    const token = tokenFrom((await latestMailTo(payload.email)).text);

    const visitor = createClient(app());
    const confirm = { token, password: 'reset password value' };
    expect((await visitor.post('/api/auth/password-reset/confirm', confirm)).statusCode).toBe(204);
    expect((await browser.get('/api/auth/me')).statusCode).toBe(401);
    const again = await visitor.post('/api/auth/password-reset/confirm', confirm);
    expect(again.json()).toEqual({ error: { code: 'invalid_token' } });

    const signIn = await visitor.post('/api/auth/sign-in', {
      email: payload.email,
      password: 'reset password value',
    });
    expect(signIn.statusCode).toBe(200);
  });

  it('rejects a made-up token', async () => {
    const response = await createClient(app()).post('/api/auth/password-reset/confirm', {
      token: 'x'.repeat(43),
      password: 'whatever password',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('invalid_token');
  });
});
