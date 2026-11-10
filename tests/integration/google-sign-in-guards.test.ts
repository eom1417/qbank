import { describe, expect, it } from 'vitest';
import { createClient } from '../support/client.js';
import { googleBrowser, locationOf, useFakeGoogle } from '../support/fake-google.js';
import { useTestApp } from '../support/test-app.js';

// M32 (DEC-42): everything that must make Google sign-in fail closed. Each failure lands on the
// sign-in page with `error=google`, never on an error page, and leaves no session behind.
let now = new Date();
const clock = { now: () => now };
const google = useFakeGoogle(clock.now);
const app = useTestApp({ google: google.config, clock });

let counter = 0;
const person = () => {
  counter += 1;
  return { sub: `guard-sub-${counter}`, email: `guard${counter}@gmail.test` };
};

const FAILED = '/sign-in?error=google';

async function expectRefused(options: Parameters<ReturnType<typeof googleBrowser>['signIn']>[1]) {
  const browser = googleBrowser(app(), google);
  const someone = person();
  const callback = await browser.signIn(someone, options);
  expect(callback.statusCode).toBe(302);
  expect(locationOf(callback)).toBe(FAILED);
  expect(callback.cookies.some((c) => c.name === 'qb_session' && c.value)).toBe(false);
  expect((await browser.get('/api/auth/me')).statusCode).toBe(401);
  const rows = await app.db().selectFrom('account').where('email', '=', someone.email).execute();
  expect(rows).toHaveLength(0);
}

describe('a callback that does not prove the person', () => {
  it.each([
    ['an unverified e-mail', { email_verified: false }],
    ['a token for another app', { aud: 'another-client.apps.googleusercontent.com' }],
    ['a token for another sign-in', { nonce: 'replayed-nonce' }],
    ['an expired token', { exp: Math.floor(Date.now() / 1000) - 60 }],
    ['a token from another issuer', { iss: 'https://evil.example' }],
    ['a token without an e-mail', { email: undefined }],
    ['a token without a subject', { sub: '' }],
  ])('refuses %s', async (_, claims) => {
    await expectRefused({ claims });
  });
});

describe('a callback that does not belong to a sign-in this browser started', () => {
  it('refuses a forged state', async () => {
    await expectRefused({ tamper: (path) => path.replace(/state=[^&]+/, 'state=forged') });
  });

  it('refuses a code Google never issued', async () => {
    await expectRefused({ tamper: (path) => path.replace(/code=[^&]+/, 'code=made-up') });
  });

  it('refuses a callback with no sign-in started in this browser', async () => {
    const browser = googleBrowser(app(), google);
    const callback = await browser.get('/api/auth/google/callback?code=abc&state=abc');
    expect(locationOf(callback)).toBe(FAILED);
  });

  it('refuses the person cancelling at Google', async () => {
    const browser = googleBrowser(app(), google);
    await browser.get('/api/auth/google/start?acceptTerms=1');
    const callback = await browser.get('/api/auth/google/callback?error=access_denied');
    expect(locationOf(callback)).toBe(FAILED);
  });

  it('refuses a sign-in started more than ten minutes ago', async () => {
    await expectRefused({
      tamper: (path) => {
        now = new Date(now.getTime() + 11 * 60_000);
        return path;
      },
    });
  });

  it('uses each started sign-in once', async () => {
    const browser = googleBrowser(app(), google);
    const start = await browser.get('/api/auth/google/start?acceptTerms=1');
    const callback = new URL(google.authorize(locationOf(start), person()));
    const path = `${callback.pathname}${callback.search}`;
    expect(locationOf(await browser.get(path))).toBe('/');
    const cookie = start.cookies.find((c) => c.name === 'qb_google')?.value ?? '';
    const replay = await app().inject({ url: path, headers: { cookie: `qb_google=${cookie}` } });
    expect(locationOf(replay)).toBe(FAILED);
  });
});

describe('where the browser goes afterwards', () => {
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'evil.com', '/\r\nSet-Cookie:x'])(
    'never leaves the app for %s',
    async (next) => {
      const browser = googleBrowser(app(), google);
      const query = `?acceptTerms=1&next=${encodeURIComponent(next)}`;
      const callback = await browser.signIn(person(), { query });
      expect(locationOf(callback)).toBe('/');
    },
  );
});

describe('passwords on a Google server', () => {
  it.each([
    ['/api/auth/sign-up', { email: 'a@b.test', password: 'long enough pw', acceptTerms: true }],
    ['/api/auth/sign-in', { email: 'a@b.test', password: 'long enough pw' }],
    ['/api/auth/password-reset/request', { email: 'a@b.test' }],
    ['/api/auth/password-reset/confirm', { token: 'x', password: 'long enough pw' }],
  ])('%s does not exist', async (url, payload) => {
    expect((await createClient(app()).post(url, payload)).statusCode).toBe(404);
  });

  it('cannot be changed by a signed-in person', async () => {
    const browser = googleBrowser(app(), google);
    await browser.signIn(person());
    const change = { currentPassword: 'whatever pw', newPassword: 'another long pw' };
    expect((await browser.post('/api/account/password', change)).statusCode).toBe(404);
    expect((await browser.post('/api/auth/sign-out')).statusCode).toBe(204);
    expect((await browser.get('/api/auth/me')).statusCode).toBe(401);
  });
});

describe('repeated attempts', () => {
  it('stops one address that keeps starting sign-ins', async () => {
    const inject = (url: string) => app().inject({ url, remoteAddress: '203.0.113.9' });
    for (let i = 0; i < 60; i += 1)
      expect((await inject('/api/auth/google/start')).statusCode).toBe(302);
    const blocked = await inject('/api/auth/google/start');
    expect(locationOf(blocked)).toBe('/sign-in?error=too_many_attempts');
    const other = await app().inject({ url: '/api/auth/google/start' });
    expect(locationOf(other)).toMatch(/^http/);
  });

  it('stops one address that keeps failing callbacks', async () => {
    const inject = () =>
      app().inject({
        url: '/api/auth/google/callback?code=x&state=y',
        remoteAddress: '203.0.113.7',
      });
    for (let i = 0; i < 20; i += 1) expect(locationOf(await inject())).toBe(FAILED);
    const before = google.exchanges.count;
    expect(locationOf(await inject())).toBe('/sign-in?error=too_many_attempts');
    expect(google.exchanges.count).toBe(before);
  });
});
