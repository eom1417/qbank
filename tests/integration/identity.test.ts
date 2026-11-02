import { describe, expect, it } from 'vitest';
import { createClient, registeredBrowser, signUpPayload } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

const app = useTestApp();

const registered = async () => (await registeredBrowser(app())).payload;

describe('identity: sign-up and session', () => {
  it('signs up, reads the current account, then signs out', async () => {
    const browser = createClient(app());
    const payload = signUpPayload({ email: '  Mixed@Example.TEST ' });
    const created = await browser.post('/api/auth/sign-up', payload);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      email: 'mixed@example.test',
      preferences: { locale: 'ar', theme: 'system', defaultSessionSize: 20 },
    });

    expect((await browser.get('/api/auth/me')).statusCode).toBe(200);
    expect((await browser.post('/api/auth/sign-out')).statusCode).toBe(204);
    expect((await browser.get('/api/auth/me')).statusCode).toBe(401);
  });

  it('rejects a second account with the same email', async () => {
    const payload = await registered();
    const again = await createClient(app()).post('/api/auth/sign-up', payload);
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: { code: 'email_taken', fields: { email: 'taken' } } });
  });

  it('rejects sign-up without accepting terms or with a short password', async () => {
    const response = await createClient(app()).post(
      '/api/auth/sign-up',
      signUpPayload({ acceptTerms: false, password: 'short' }),
    );
    expect(response.statusCode).toBe(400);
    expect(Object.keys(response.json().error.fields).sort()).toEqual(['acceptTerms', 'password']);
  });
});

describe('identity: sign-in and request origin', () => {
  it('gives the same answer for a wrong password and an unknown email', async () => {
    const payload = await registered();
    const attempt = (email: string) =>
      createClient(app()).post('/api/auth/sign-in', { email, password: 'not the password' });
    const wrong = await attempt(payload.email);
    const unknown = await attempt('nobody@example.test');
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json()).toEqual(wrong.json());
  });

  it('signs in again with the right password', async () => {
    const payload = await registered();
    const browser = createClient(app());
    const response = await browser.post('/api/auth/sign-in', {
      email: payload.email,
      password: payload.password,
    });
    expect(response.statusCode).toBe(200);
    expect((await browser.get('/api/auth/me')).json().email).toBe(payload.email);
  });

  it('refuses state-changing requests from a foreign origin', async () => {
    const response = await createClient(app()).post(
      '/api/auth/sign-up',
      signUpPayload(),
      'https://evil.example',
    );
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: { code: 'forbidden_origin' } });
  });
});

describe('identity: same-host origin', () => {
  it('accepts a mutation whose Origin matches the Host it was sent to', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      headers: { host: 'qbank.local', origin: 'http://qbank.local' },
      payload: signUpPayload(),
    });
    expect(response.statusCode).toBe(201);
  });
});
