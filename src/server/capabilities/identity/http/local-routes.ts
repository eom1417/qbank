import { BlockList, isIP, isIPv6 } from 'node:net';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PairRequest, type PairingCodeResponse } from '../../../../contracts/identity.js';
import { AppError } from '../../../platform/errors/index.js';
import { createAttemptLimiter } from '../../../platform/http/attempts.js';
import { lanOrigin } from '../../../platform/http/lan.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { IdentityDeps } from '../use-cases/deps.js';
import type { PairingCode } from '../adapters/pairing-token.js';
import { pairBrowser, signOutOtherDevices } from '../use-cases/local-owner.js';
import { toAccountResponse } from './presenters.js';
import type { RequireActor } from './require-actor.js';
import { readSessionToken, setSessionCookie } from './session-cookie.js';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const PROXY_HEADERS = ['x-forwarded-for', 'x-forwarded-host', 'forwarded', 'x-real-ip'];

/**
 * The configured peers that also count as this computer (M25): Docker's network, when the port
 * is published to the host's loopback only. Addresses or CIDR ranges, IPv4 or IPv6.
 */
function peersOf(list: readonly string[]): BlockList {
  const peers = new BlockList();
  for (const entry of list) {
    const [address = '', bits] = entry.split('/');
    const family = isIPv6(address) ? 'ipv6' : 'ipv4';
    if (!isIP(address)) throw new Error(`QBANK_LOCAL_PEERS: not an address: ${entry}`);
    if (bits === undefined) peers.addAddress(address, family);
    else peers.addSubnet(address, Number(bits), family);
  }
  return peers;
}

/** The peer's address, an IPv4 one even when the socket reports it IPv4-mapped. */
const socketAddress = (request: FastifyRequest) =>
  (request.socket.remoteAddress ?? '').replace(/^::ffff:(?=\d+\.)/, '');

/**
 * A request from this computer itself: a loopback socket (or a configured peer), no proxy in
 * between (a proxy may carry a visitor from anywhere), and a loopback Host (a DNS-rebinding page
 * cannot claim that name).
 */
function isFromThisComputer(request: FastifyRequest, peers: BlockList): boolean {
  if (PROXY_HEADERS.some((name) => request.headers[name] !== undefined)) return false;
  const host = (request.headers.host ?? '').replace(/:\d+$/, '');
  if (!LOOPBACK_HOSTS.has(host)) return false;
  const address = socketAddress(request);
  if (LOOPBACK_ADDRESSES.has(address)) return true;
  return isIP(address) !== 0 && peers.check(address, isIPv6(address) ? 'ipv6' : 'ipv4');
}

interface LocalRouteOptions {
  deps: IdentityDeps;
  requireActor: RequireActor;
  pairing: PairingCode;
  cookieSecure: boolean;
  /** Never pair this computer without the code (for installs reached through a TCP tunnel). */
  requirePairingCode: boolean;
  localPeers: readonly string[];
}

/** A wrong pairing code may be tried this often per address before a pause. */
const PAIRING_ATTEMPTS = { max: 10, windowMs: 15 * 60_000 };

/** Local mode (DEC-31): browsers pair with the install instead of signing in. */
export function registerLocalRoutes(app: FastifyInstance, options: LocalRouteOptions) {
  const { deps, requireActor, pairing, cookieSecure } = options;
  const peers = peersOf(options.localPeers);
  const attempts = createAttemptLimiter({ ...PAIRING_ATTEMPTS, now: () => deps.clock.now() });
  app.get('/api/local/pairing', async (request): Promise<PairingCodeResponse> => {
    await requireActor(request);
    return { code: pairing.current(), lanOrigin: lanOrigin(app.server) };
  });
  // A lost phone or a shared link: every other device is signed out and the old code stops.
  app.post('/api/local/devices/sign-out-others', async (request): Promise<PairingCodeResponse> => {
    const actor = await requireActor(request);
    await signOutOtherDevices(deps, actor.accountId, readSessionToken(request));
    return { code: pairing.replace(), lanOrigin: lanOrigin(app.server) };
  });
  app.post('/api/local/pair', async (request, reply) => {
    const { token, locale } = parseInput(PairRequest, request.body ?? {});
    if (attempts.blocked(request.ip)) throw new AppError('too_many_attempts');
    const proof = {
      fromThisComputer: !options.requirePairingCode && isFromThisComputer(request, peers),
      presented: token,
      expected: pairing.current(),
    };
    const paired = await pairBrowser(deps, proof, locale).catch((error: unknown) => {
      if (error instanceof AppError && error.code === 'pairing_required') attempts.fail(request.ip);
      throw error;
    });
    attempts.clear(request.ip);
    const { account, session } = paired;
    setSessionCookie(reply, session, cookieSecure);
    return toAccountResponse(account);
  });
}
