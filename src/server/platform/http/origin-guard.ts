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
 * or to an explicitly allowed origin.
 */
export function createOriginGuard(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);
  return async function originGuard(request: FastifyRequest): Promise<void> {
    if (SAFE_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (origin && (allowed.has(origin) || originHost(origin) === request.host)) return;
    throw new AppError('forbidden_origin');
  };
}
