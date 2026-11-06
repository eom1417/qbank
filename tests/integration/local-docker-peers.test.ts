import { describe, expect, it } from 'vitest';
import { useTestApp } from '../support/test-app.js';

// M25: in Docker the browser on this computer reaches QBank through Docker's network, so its
// address is the network's gateway, not loopback. compose.yaml publishes the port to the host's
// loopback only and lists Docker's ranges in QBANK_LOCAL_PEERS.
const app = useTestApp({ local: true, localPeers: ['172.16.0.0/12', '192.168.65.0/24'] });

const pair = (remoteAddress: string, host = 'localhost:3000', extra: Record<string, string> = {}) =>
  app().inject({
    method: 'POST',
    url: '/api/local/pair',
    headers: { host, origin: `http://${host}`, ...extra },
    payload: {},
    remoteAddress,
  });

describe("this computer through Docker's network (M25)", () => {
  it('pairs the browser of this computer with no code, from a listed Docker address', async () => {
    for (const gateway of ['172.17.0.1', '172.18.0.1', '::ffff:172.17.0.1', '192.168.65.1']) {
      const paired = await pair(gateway);
      expect([gateway, paired.statusCode]).toEqual([gateway, 200]);
    }
  });

  it('still asks for the code from any other address, host name or proxy', async () => {
    const refused = [
      await pair('192.168.1.20'),
      await pair('10.0.0.5'),
      await pair('172.17.0.1', 'qbank.example:3000'),
      await pair('172.17.0.1', 'localhost:3000', { 'x-forwarded-for': '203.0.113.9' }),
    ];
    for (const response of refused) expect(response.json().error.code).toBe('pairing_required');
  });
});
