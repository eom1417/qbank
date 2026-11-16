import { BlockList, isIP } from 'node:net';
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** Whether an address is a proxy we run, allowed to name the visitor (QBANK_TRUSTED_PROXIES). */
export type ProxyTrust = (address: string) => boolean;

type Interfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

const plain = (address: string) => address.trim().replace(/^::ffff:(?=\d+\.)/, '');
const familyOf = (address: string) => (isIP(address) === 6 ? 'ipv6' : 'ipv4');

/** The subnets this container is attached to: its Docker networks (Traefik, Caddy, the db). */
function ownSubnets(interfaces: Interfaces): string[] {
  const all = Object.values(interfaces).flatMap((list) => list ?? []);
  return all.filter((info) => !info.internal && info.cidr).map((info) => info.cidr as string);
}

function addEntry(list: BlockList, entry: string, interfaces: Interfaces): void {
  if (entry === 'loopback') {
    list.addSubnet('127.0.0.0', 8, 'ipv4');
    list.addAddress('::1', 'ipv6');
    return;
  }
  if (entry === 'container-networks') {
    for (const cidr of ownSubnets(interfaces)) addEntry(list, cidr, interfaces);
    return;
  }
  const [address = '', bits] = entry.split('/');
  if (!isIP(address)) throw new Error(`QBANK_TRUSTED_PROXIES: not an address or range: ${entry}`);
  if (bits === undefined) list.addAddress(address, familyOf(address));
  else list.addSubnet(address, Number(bits), familyOf(address));
}

/** Addresses, CIDR ranges, `loopback` and `container-networks`; anything else stops startup. */
export function createProxyTrust(
  entries: readonly string[],
  interfaces: Interfaces = networkInterfaces(),
): ProxyTrust {
  const list = new BlockList();
  for (const entry of entries) addEntry(list, entry.trim(), interfaces);
  return (address) => {
    const ip = plain(address);
    return isIP(ip) !== 0 && list.check(ip, familyOf(ip));
  };
}

/** Every address the request came through, nearest first: the socket, then X-Forwarded-For. */
function chainOf(request: FastifyRequest): string[] {
  const forwarded = String(request.raw.headers['x-forwarded-for'] ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean)
    .reverse();
  return [request.raw.socket.remoteAddress ?? '', ...forwarded];
}

function visitorScheme(value: unknown): 'http' | 'https' | null {
  try {
    const scheme: unknown = JSON.parse(String(value)).scheme;
    return scheme === 'http' || scheme === 'https' ? scheme : null;
  } catch {
    return null;
  }
}

/**
 * Behind Cloudflare Tunnel (QBANK_PROXY_HEADERS=cloudflare): when every hop is trusted, the
 * visitor's address (CF-Connecting-IP) and scheme (CF-Visitor) become the standard forwarded
 * headers, so request.ip and request.protocol are the visitor's. An http visitor is sent to the
 * same path on https, only for a host QBank serves; https answers carry HSTS.
 */
export function registerCloudflareEdge(
  app: FastifyInstance,
  trust: ProxyTrust,
  allowedOrigins: readonly string[],
): void {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!chainOf(request).every(trust)) return;
    const headers = request.raw.headers;
    const visitor = plain(String(headers['cf-connecting-ip'] ?? ''));
    if (isIP(visitor)) {
      const forwarded = headers['x-forwarded-for'];
      headers['x-forwarded-for'] = forwarded ? `${visitor}, ${String(forwarded)}` : visitor;
    }
    const scheme = visitorScheme(headers['cf-visitor']);
    if (scheme) headers['x-forwarded-proto'] = scheme;
    if (scheme === 'https') void reply.header('strict-transport-security', 'max-age=15552000');
    const secure = `https://${request.host}`;
    if (scheme === 'http' && allowedOrigins.includes(secure))
      return reply.redirect(`${secure}${request.url}`, 308);
  });
}
