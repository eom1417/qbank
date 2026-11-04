import { describe, expect, it } from 'vitest';
import { ORIGIN, TEST_PAIRING_TOKEN, useTestApp } from '../support/test-app.js';

// A pairing code can be guessed only so often from one address before a pause.
let now = new Date('2026-11-04T10:00:00Z');
const app = useTestApp({ local: true, clock: { now: () => now } });

const pair = (remoteAddress: string, token: string) =>
  app().inject({
    method: 'POST',
    url: '/api/local/pair',
    headers: { host: 'qbank.example:3000', origin: ORIGIN },
    payload: { token },
    remoteAddress,
  });

describe('pairing attempts', () => {
  it('pauses an address after ten wrong codes, even for the right one, then lets it in', async () => {
    const phone = '198.51.100.7';
    for (let attempt = 0; attempt < 10; attempt++)
      expect((await pair(phone, 'wrong-code')).statusCode).toBe(401);
    const paused = await pair(phone, TEST_PAIRING_TOKEN);
    expect([paused.statusCode, paused.json().error.code]).toEqual([429, 'too_many_attempts']);
    expect((await pair('198.51.100.8', TEST_PAIRING_TOKEN)).statusCode).toBe(200);
    now = new Date(now.getTime() + 16 * 60_000);
    expect((await pair(phone, TEST_PAIRING_TOKEN)).statusCode).toBe(200);
  });
});
