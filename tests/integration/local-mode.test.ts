import type { InjectOptions } from 'fastify';
import { describe, expect, it } from 'vitest';
import { ORIGIN, TEST_PAIRING_TOKEN, useTestApp } from '../support/test-app.js';

// Local mode (DEC-31): one owner, no sign-up; browsers pair from this computer or with the code.
const app = useTestApp({ local: true });

const THIS_COMPUTER = { host: 'localhost:3000', origin: ORIGIN };

async function pair(headers: Record<string, string>, payload: object = {}) {
  const options: InjectOptions = { method: 'POST', url: '/api/local/pair', headers, payload };
  const response = await app().inject({ ...options, remoteAddress: '127.0.0.1' });
  const cookie = response.cookies.find((c) => c.name === 'qb_session')?.value;
  return { response, cookie: cookie ? `qb_session=${cookie}` : '' };
}

describe('local mode', () => {
  it('reports its mode and has no sign-up or password sign-in', async () => {
    expect((await app().inject({ url: '/api/meta' })).json()).toEqual({ mode: 'local' });
    for (const url of ['/api/auth/sign-up', '/api/auth/sign-in', '/api/account/password']) {
      const response = await app().inject({
        method: 'POST',
        url,
        headers: THIS_COMPUTER,
        payload: {},
      });
      expect(response.statusCode).toBe(404);
    }
  });

  it('pairs a browser on this computer with the one local owner, every time', async () => {
    const first = await pair(THIS_COMPUTER);
    expect(first.response.statusCode).toBe(200);
    const me = await app().inject({ url: '/api/auth/me', headers: { cookie: first.cookie } });
    expect(me.json()).toMatchObject({ id: first.response.json().id });
    const second = await pair(THIS_COMPUTER);
    expect(second.response.json().id).toBe(first.response.json().id);
    const banks = await app().inject({ url: '/api/banks', headers: { cookie: second.cookie } });
    expect(banks.statusCode).toBe(200);
    const code = await app().inject({
      url: '/api/local/pairing',
      headers: { cookie: second.cookie },
    });
    expect(code.json()).toEqual({ code: TEST_PAIRING_TOKEN });
  });

  it('needs the pairing code through a proxy or another network address', async () => {
    const viaProxy = { ...THIS_COMPUTER, 'x-forwarded-for': '203.0.113.9' };
    const refused = await pair(viaProxy);
    expect([refused.response.statusCode, refused.response.json().error.code]).toEqual([
      401,
      'pairing_required',
    ]);
    expect((await pair(viaProxy, { token: 'wrong-code' })).response.statusCode).toBe(401);
    const paired = await pair(viaProxy, { token: TEST_PAIRING_TOKEN });
    expect(paired.response.statusCode).toBe(200);
    expect(paired.cookie).not.toBe('');
  });
});

describe('local mode refusals', () => {
  it('refuses a page that only points its own name at this computer (DNS rebinding)', async () => {
    const rebinding = { host: 'attacker.example:3000', origin: 'http://attacker.example:3000' };
    expect((await pair(rebinding)).response.statusCode).toBe(401);
  });

  it('keeps private routes closed to an unpaired browser', async () => {
    expect((await app().inject({ url: '/api/banks' })).statusCode).toBe(401);
    expect((await app().inject({ url: '/api/local/pairing' })).statusCode).toBe(401);
  });
});
