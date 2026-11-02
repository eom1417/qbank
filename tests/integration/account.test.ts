import { describe, expect, it } from 'vitest';
import { createClient, registeredBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

const app = useTestApp();

describe('account preferences (FR-02-005, FR-21-010)', () => {
  it('saves name, language, theme and study preferences on the server', async () => {
    const { browser } = await registeredBrowser(app());
    const changes = {
      displayName: 'Sara',
      locale: 'en',
      theme: 'dark',
      defaultSessionSize: 40,
      explanationMode: 'on_request',
    };
    const response = await browser.patch('/api/account', changes);
    expect(response.statusCode).toBe(200);
    const me = (await browser.get('/api/auth/me')).json();
    expect(me.displayName).toBe('Sara');
    expect(me.preferences).toEqual({
      locale: 'en',
      theme: 'dark',
      defaultSessionSize: 40,
      explanationMode: 'on_request',
    });
  });

  it('rejects an empty update, unknown fields and out-of-range values', async () => {
    const { browser } = await registeredBrowser(app());
    expect((await browser.patch('/api/account', {})).statusCode).toBe(400);
    expect((await browser.patch('/api/account', { email: 'x@y.test' })).statusCode).toBe(400);
    const tooBig = await browser.patch('/api/account', { defaultSessionSize: 500 });
    expect(tooBig.json().error.fields).toEqual({ defaultSessionSize: 'too_big' });
    expect((await createClient(app()).patch('/api/account', { theme: 'dark' })).statusCode).toBe(
      401,
    );
  });
});

describe('change password', () => {
  it('requires the current password, then signs other devices out but keeps this one', async () => {
    const { browser, payload } = await registeredBrowser(app());
    const laptop = createClient(app());
    await laptop.post('/api/auth/sign-in', { email: payload.email, password: payload.password });

    const wrong = await browser.post('/api/account/password', {
      currentPassword: 'not it at all',
      newPassword: 'a brand new password',
    });
    expect(wrong.json()).toEqual({
      error: { code: 'validation_failed', fields: { currentPassword: 'incorrect' } },
    });

    const changed = await browser.post('/api/account/password', {
      currentPassword: payload.password,
      newPassword: 'a brand new password',
    });
    expect(changed.statusCode).toBe(204);
    expect((await browser.get('/api/auth/me')).statusCode).toBe(200);
    expect((await laptop.get('/api/auth/me')).statusCode).toBe(401);
  });
});
