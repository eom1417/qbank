import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const PRIVATE = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv6');
}

const isPrivateAddress = (address: string): boolean => {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return PRIVATE.check(mapped, 'ipv4');
  return PRIVATE.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
};

/**
 * SSRF guard for user-supplied provider URLs: only https to public addresses, unless the
 * operator allows private hosts (local development). Checked on save and again before each call.
 */
export async function isAllowedEndpoint(url: string, allowPrivate: boolean): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (allowPrivate) return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  try {
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    return addresses.length > 0 && !addresses.some((entry) => isPrivateAddress(entry.address));
  } catch {
    return false;
  }
}
