import type { FastifyRequest } from 'fastify';
import { AppError } from '../errors/index.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

/**
 * CSRF defence for cookie sessions (together with SameSite=Lax): a state-changing request must
 * carry an Origin equal to the request's own host (X-Forwarded-Host only when trustProxy is on)
 * or to an explicitly allowed origin. A call authenticated by a key alone has no session to ride.
 */
export function createOriginGuard(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);
  return async function originGuard(request: FastifyRequest): Promise<void> {
    if (SAFE_METHODS.has(request.method)) return;
    // A key in Authorization and no cookie (an agent's call, M23): a page on another site cannot
    // send that header without a CORS grant, which QBank never gives, so there is nothing to forge.
    if (/^Bearer \S+$/.test(request.headers.authorization ?? '') && !request.headers.cookie) return;
    const origin = request.headers.origin;
    if (origin && (allowed.has(origin) || originHost(origin) === request.host)) return;
    throw new AppError('forbidden_origin');
  };
}
