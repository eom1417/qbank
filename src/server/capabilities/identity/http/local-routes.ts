import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PairRequest, type PairingCodeResponse } from '../../../../contracts/identity.js';
import { AppError } from '../../../platform/errors/index.js';
import { createAttemptLimiter } from '../../../platform/http/attempts.js';
import { lanOrigin } from '../../../platform/http/lan.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { IdentityDeps } from '../use-cases/deps.js';
import { pairBrowser } from '../use-cases/local-owner.js';
import { toAccountResponse } from './presenters.js';
import type { RequireActor } from './require-actor.js';
import { setSessionCookie } from './session-cookie.js';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const PROXY_HEADERS = ['x-forwarded-for', 'x-forwarded-host', 'forwarded', 'x-real-ip'];

/**
 * A request from this computer itself: a loopback socket, no proxy in between (a proxy may carry
 * a visitor from anywhere), and a loopback Host (a DNS-rebinding page cannot claim that name).
 */
function isFromThisComputer(request: FastifyRequest): boolean {
  if (PROXY_HEADERS.some((name) => request.headers[name] !== undefined)) return false;
  const host = (request.headers.host ?? '').replace(/:\d+$/, '');
  return LOOPBACK_ADDRESSES.has(request.socket.remoteAddress ?? '') && LOOPBACK_HOSTS.has(host);
}

interface LocalRouteOptions {
  deps: IdentityDeps;
  requireActor: RequireActor;
  pairingToken: string;
  cookieSecure: boolean;
}

/** A wrong pairing code may be tried this often per address before a pause. */
const PAIRING_ATTEMPTS = { max: 10, windowMs: 15 * 60_000 };

/** Local mode (DEC-31): browsers pair with the install instead of signing in. */
export function registerLocalRoutes(app: FastifyInstance, options: LocalRouteOptions) {
  const { deps, requireActor, pairingToken, cookieSecure } = options;
  const attempts = createAttemptLimiter({ ...PAIRING_ATTEMPTS, now: () => deps.clock.now() });
  app.get('/api/local/pairing', async (request): Promise<PairingCodeResponse> => {
    await requireActor(request);
    return { code: pairingToken, lanOrigin: lanOrigin(app.server) };
  });
  app.post('/api/local/pair', async (request, reply) => {
    const { token, locale } = parseInput(PairRequest, request.body ?? {});
    if (attempts.blocked(request.ip)) throw new AppError('too_many_attempts');
    const proof = {
      fromThisComputer: isFromThisComputer(request),
      presented: token,
      expected: pairingToken,
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
