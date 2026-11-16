import type { NetworkInterfaceInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/server/platform/config/index.js';
import { createProxyTrust } from '../../../src/server/platform/http/trusted-proxy.js';

const iface = (cidr: string, internal = false) =>
  ({ cidr, internal, address: cidr.split('/')[0] }) as NetworkInterfaceInfo;

// A container on its compose network (10.0.2.0/24) and loopback.
const CONTAINER = { lo: [iface('127.0.0.1/8', true)], eth0: [iface('10.0.2.7/24')] };

describe('createProxyTrust', () => {
  it('trusts the container networks it is attached to, and nothing beyond them', () => {
    const trust = createProxyTrust(['container-networks'], CONTAINER);
    expect(trust('10.0.2.5')).toBe(true);
    expect(trust('::ffff:10.0.2.5')).toBe(true);
    expect(trust('10.0.3.5')).toBe(false);
    expect(trust('192.168.1.50')).toBe(false);
    expect(trust('127.0.0.1')).toBe(false);
  });

  it('takes single addresses, ranges and loopback; rejects anything that is not an address', () => {
    const trust = createProxyTrust(['10.0.1.1', '172.20.0.0/16', 'loopback'], CONTAINER);
    expect([trust('10.0.1.1'), trust('10.0.1.2')]).toEqual([true, false]);
    expect([trust('172.20.9.9'), trust('127.0.0.1'), trust('::1')]).toEqual([true, true, true]);
    expect(trust('unknown')).toBe(false);
    expect(() => createProxyTrust(['traefik'], CONTAINER)).toThrow(/QBANK_TRUSTED_PROXIES/);
  });

  it('trusts nobody when no proxy is configured', () => {
    expect(createProxyTrust([], CONTAINER)('127.0.0.1')).toBe(false);
  });
});

describe('proxy settings', () => {
  const env = { QBANK_MODE: 'accounts', DATABASE_URL: 'postgres://x' } as const;

  it('trusts no proxy unless QBANK_TRUST_PROXY is on, then loopback by default', () => {
    expect(loadConfig({ ...env, QBANK_TRUSTED_PROXIES: '10.0.1.1' }).trustedProxies).toEqual([]);
    expect(loadConfig({ ...env, QBANK_TRUST_PROXY: 'true' }).trustedProxies).toEqual(['loopback']);
    const coolify = loadConfig({
      ...env,
      QBANK_TRUST_PROXY: 'true',
      QBANK_TRUSTED_PROXIES: 'container-networks, 10.0.1.1',
      QBANK_PROXY_HEADERS: 'cloudflare',
    });
    expect([coolify.trustedProxies, coolify.proxyHeaders]).toEqual([
      ['container-networks', '10.0.1.1'],
      'cloudflare',
    ]);
    expect(loadConfig(env).proxyHeaders).toBe('none');
  });
});
