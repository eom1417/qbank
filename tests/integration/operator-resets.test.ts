import { describe, expect, it } from 'vitest';
import { createClient, registeredBrowser } from '../support/client.js';
import { signedInOperator } from '../support/operator.js';
import { ORIGIN, useTestApp } from '../support/test-app.js';

// M31 (B4): the server sends no e-mail, so a reset request reaches the operator, who passes the
// link on by hand. The operator never sees or sets a password.
const app = useTestApp();

const tokenOf = (link: string) => /#token=([\w-]+)/.exec(link)?.[1] ?? '';

/** A registered account that has tapped "forgot password". */
async function forgotten() {
  const { payload } = await registeredBrowser(app());
  await createClient(app()).post('/api/auth/password-reset/request', { email: payload.email });
  const { browser: operator } = await signedInOperator(app());
  const list = (await operator.get('/api/operator/resets')).json();
  const item = list.items.find((i: { email: string }) => i.email === payload.email);
  return { payload, operator, item };
}

async function resetAndSignIn(token: string, email: string, password: string) {
  const visitor = createClient(app());
  const confirm = await visitor.post('/api/auth/password-reset/confirm', { token, password });
  if (confirm.statusCode !== 204) return confirm.statusCode;
  return (await visitor.post('/api/auth/sign-in', { email, password })).statusCode;
}

describe('password reset through the operator (M31, B4)', () => {
  it('lists the request and hands over the link the user can reset with', async () => {
    const { payload, operator, item } = await forgotten();
    expect(item).toMatchObject({ displayName: payload.displayName, expired: false });
    expect(JSON.stringify(item)).not.toMatch(/hash|token/i);

    const response = await operator.post(`/api/operator/resets/${item.accountId}/link`, {});
    expect(response.statusCode).toBe(200);
    const { link, fresh, expiresAt } = response.json();
    expect(fresh).toBe(false);
    expect(expiresAt).toBe(item.expiresAt);
    expect(link.startsWith(`${ORIGIN}/reset-password#token=`)).toBe(true);
    expect(await resetAndSignIn(tokenOf(link), payload.email, 'brand new password')).toBe(200);

    const after = (await operator.get('/api/operator/resets')).json();
    expect(after.items.some((i: { email: string }) => i.email === payload.email)).toBe(false);
  });

  it('makes a fresh link when the request expired; the old link stays refused', async () => {
    const { payload, operator, item } = await forgotten();
    const first = await operator.post(`/api/operator/resets/${item.accountId}/link`, {});
    const oldToken = tokenOf(first.json().link);
    await app
      .db()
      .updateTable('password_reset')
      .set({ expires_at: new Date(Date.now() - 1000) })
      .where('account_id', '=', item.accountId)
      .execute();
    const expired = (await operator.get('/api/operator/resets')).json();
    expect(expired.items.find((i: { email: string }) => i.email === payload.email).expired).toBe(
      true,
    );

    const renewed = (await operator.post(`/api/operator/resets/${item.accountId}/link`, {})).json();
    expect(renewed.fresh).toBe(true);
    expect(tokenOf(renewed.link)).not.toBe(oldToken);
    expect(await resetAndSignIn(oldToken, payload.email, 'old link password')).toBe(400);
    expect(await resetAndSignIn(tokenOf(renewed.link), payload.email, 'renewed password')).toBe(
      200,
    );
  });
});

describe('what the operator cannot get (M31, B4)', () => {
  it('gives no link for an account that asked for none', async () => {
    const { browser, payload } = await registeredBrowser(app());
    const me = (await browser.get('/api/auth/me')).json();
    const { browser: operator } = await signedInOperator(app());
    const list = (await operator.get('/api/operator/resets')).json();
    expect(list.items.some((i: { email: string }) => i.email === payload.email)).toBe(false);
    const response = await operator.post(`/api/operator/resets/${me.id}/link`, {});
    expect(response.statusCode).toBe(404);
    expect((await operator.post('/api/operator/resets/nope/link', {})).statusCode).toBe(404);
  });
});
