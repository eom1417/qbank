import { describe, expect, it } from 'vitest';
import { createClient } from '../support/client.js';
import { googleBrowser, locationOf, seedAccount, useFakeGoogle } from '../support/fake-google.js';
import { OPERATOR_EMAIL, ORIGIN, useTestApp } from '../support/test-app.js';

// M32 (DEC-42): a server with a Google client signs people in with Google only. Google proves the
// e-mail, so an existing account is linked by it, and the declared operator needs no shell step.
const google = useFakeGoogle();
const app = useTestApp({ google: google.config });

let counter = 0;
const person = (overrides: { email?: string; name?: string } = {}) => {
  counter += 1;
  return { sub: `google-sub-${counter}`, email: `person${counter}@gmail.test`, ...overrides };
};

const accountsWithEmail = async (email: string) =>
  (await app.db().selectFrom('account').select('id').where('email', '=', email).execute()).length;

describe('starting Google sign-in', () => {
  it('sends the browser to Google with state, nonce and PKCE, and keeps them in a cookie', async () => {
    const start = await googleBrowser(app(), google).get('/api/auth/google/start?acceptTerms=1');
    expect(start.statusCode).toBe(302);
    const location = new URL(locationOf(start));
    expect(`${location.origin}${location.pathname}`).toBe(google.config.authUrl);
    const asked = Object.fromEntries(location.searchParams);
    expect(asked).toMatchObject({
      response_type: 'code',
      client_id: google.config.clientId,
      redirect_uri: `${ORIGIN}/api/auth/google/callback`,
      scope: 'openid email profile',
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    for (const key of ['state', 'nonce', 'code_challenge'])
      expect(asked[key]?.length).toBeGreaterThanOrEqual(43);
    expect(asked['state']).not.toBe(asked['nonce']);
    const cookie = start.cookies.find((c) => c.name === 'qb_google');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', maxAge: 600 });
    // The cookie is a random key: none of the flow's secrets travel in it.
    for (const key of ['state', 'nonce', 'code_challenge'])
      expect(cookie?.value).not.toContain(asked[key]);
  });

  it('tells every visitor that this server signs in with Google', async () => {
    expect((await createClient(app()).get('/api/meta')).json()).toMatchObject({
      mode: 'accounts',
      signIn: 'google',
    });
  });
});

describe('a new person', () => {
  it('gets an account and a session when they accepted the terms', async () => {
    const browser = googleBrowser(app(), google);
    const someone = person({ name: 'Sara Ali' });
    const callback = await browser.signIn(someone, { query: '?acceptTerms=1&next=/banks/1' });
    expect(callback.statusCode).toBe(302);
    expect(locationOf(callback)).toBe('/banks/1');
    expect(callback.cookies.find((c) => c.name === 'qb_google')?.value).toBe('');
    const me = (await browser.get('/api/auth/me')).json();
    expect(me).toMatchObject({ email: someone.email, displayName: 'Sara Ali', isOperator: false });
    expect(me.preferences.locale).toBe('ar');
    const row = await app
      .db()
      .selectFrom('account')
      .select(['google_sub', 'password_hash', 'terms_accepted_at'])
      .where('id', '=', me.id)
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({ google_sub: someone.sub, password_hash: null });
    expect(row.terms_accepted_at).toBeInstanceOf(Date);
  });

  it('is named after their e-mail when Google gives no name', async () => {
    const browser = googleBrowser(app(), google);
    await browser.signIn(person({ email: 'Noura.K@Gmail.test' }));
    expect((await browser.get('/api/auth/me')).json()).toMatchObject({
      email: 'noura.k@gmail.test',
      displayName: 'noura.k',
    });
  });

  it('is sent back to sign up, with no account, when the terms were not accepted', async () => {
    const browser = googleBrowser(app(), google);
    const someone = person();
    const callback = await browser.signIn(someone, { query: '' });
    expect(locationOf(callback)).toBe('/sign-up?error=terms');
    expect(await accountsWithEmail(someone.email)).toBe(0);
    expect((await browser.get('/api/auth/me')).statusCode).toBe(401);
  });
});

describe('a returning person', () => {
  it('links an existing password account by its e-mail and ends its old sessions', async () => {
    const email = 'had.a.password@gmail.test';
    const old = await seedAccount(app.db(), { email, passwordHash: 'argon2-hash-of-old-password' });
    const oldMe = () => app().inject({ url: '/api/auth/me', headers: { cookie: old.cookie } });
    expect((await oldMe()).statusCode).toBe(200);
    const browser = googleBrowser(app(), google);
    const callback = await browser.signIn(person({ email: email.toUpperCase() }), { query: '' });
    expect(locationOf(callback)).toBe('/');
    expect((await browser.get('/api/auth/me')).json().id).toBe(old.id);
    expect(await accountsWithEmail(email)).toBe(1);
    // The e-mail was never verified before: whoever was signed in to the account is signed out.
    expect((await oldMe()).statusCode).toBe(401);
  });

  it('is found by their Google id even after changing their e-mail at Google', async () => {
    const someone = person();
    const first = googleBrowser(app(), google);
    await first.signIn(someone);
    const id = (await first.get('/api/auth/me')).json().id;
    const again = googleBrowser(app(), google);
    const callback = await again.signIn({ ...someone, email: 'renamed@gmail.test' }, { query: '' });
    expect(locationOf(callback)).toBe('/');
    expect((await again.get('/api/auth/me')).json().id).toBe(id);
    expect(await accountsWithEmail('renamed@gmail.test')).toBe(0);
    // The first browser stays signed in: a returning person's other devices are left alone.
    expect((await first.get('/api/auth/me')).statusCode).toBe(200);
  });

  it('cannot take over an account already linked to another Google person', async () => {
    const owner = person();
    await googleBrowser(app(), google).signIn(owner);
    const other = googleBrowser(app(), google);
    const callback = await other.signIn({ sub: 'someone-else', email: owner.email });
    expect(locationOf(callback)).toBe('/sign-in?error=google');
    expect((await other.get('/api/auth/me')).statusCode).toBe(401);
  });
});

describe('the operator on a Google server', () => {
  it('is the declared e-mail proven by Google, with no confirmation from the shell', async () => {
    const browser = googleBrowser(app(), google);
    await browser.signIn({ sub: 'operator-sub', email: OPERATOR_EMAIL, name: 'Operator' });
    expect((await browser.get('/api/auth/me')).json().isOperator).toBe(true);
    const resets = await browser.get('/api/operator/resets');
    expect(resets.statusCode).toBe(200);
    // No passwords, so nobody asks the operator for a reset link.
    expect(resets.json().items).toEqual([]);
  });

  it('is nobody else', async () => {
    const browser = googleBrowser(app(), google);
    await browser.signIn(person());
    expect((await browser.get('/api/auth/me')).json().isOperator).toBe(false);
    expect((await browser.get('/api/operator/resets')).statusCode).toBe(403);
  });
});
