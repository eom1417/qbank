import { describe, expect, it } from 'vitest';
import { ORIGIN, TEST_PAIRING_TOKEN, useTestApp } from '../support/test-app.js';

// M17.4 findings in local mode: revoking devices, and code-only pairing.
const app = useTestApp({ local: true });
const strict = useTestApp({ local: true, requirePairingCode: true });

const THIS_COMPUTER = { host: 'localhost:3000', origin: ORIGIN };
const pair = (target: typeof app, payload: object = {}, remoteAddress = '127.0.0.1') =>
  target().inject({
    method: 'POST',
    url: '/api/local/pair',
    headers: THIS_COMPUTER,
    payload,
    remoteAddress,
  });
const cookieOf = (response: Awaited<ReturnType<typeof pair>>) =>
  `qb_session=${response.cookies.find((c) => c.name === 'qb_session')?.value}`;
const me = (cookie: string) =>
  app().inject({ url: '/api/auth/me', headers: { ...THIS_COMPUTER, cookie } });

describe('local mode, after the security review (M17.4)', () => {
  it('signs every other device out and replaces the code; the old code stops working', async () => {
    const laptop = cookieOf(await pair(app));
    const phone = cookieOf(await pair(app, { token: TEST_PAIRING_TOKEN }, '192.0.2.10'));
    const revoked = await app().inject({
      method: 'POST',
      url: '/api/local/devices/sign-out-others',
      headers: { ...THIS_COMPUTER, cookie: laptop },
    });
    const { code } = revoked.json();
    expect(code).not.toBe(TEST_PAIRING_TOKEN);
    expect((await me(laptop)).statusCode).toBe(200);
    expect((await me(phone)).statusCode).toBe(401);
    expect((await pair(app, { token: TEST_PAIRING_TOKEN }, '192.0.2.11')).statusCode).toBe(401);
    expect((await pair(app, { token: code }, '192.0.2.11')).statusCode).toBe(200);
  });

  it('can require the code even from this computer (a TCP tunnel looks local)', async () => {
    expect((await pair(strict)).statusCode).toBe(401);
    expect((await pair(strict, { token: TEST_PAIRING_TOKEN })).statusCode).toBe(200);
  });
});
