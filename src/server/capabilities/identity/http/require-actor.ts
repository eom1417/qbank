import type { FastifyRequest } from 'fastify';
import { AppError } from '../../../platform/errors/index.js';
import type { Actor } from '../domain/account.js';
import type { IdentityDeps } from '../use-cases/deps.js';
import { resolveActor } from '../use-cases/sessions.js';
import { readSessionToken } from './session-cookie.js';

export type RequireActor = (request: FastifyRequest) => Promise<Actor>;

/** The authentication gate for every private route: a valid session or 401. */
export function createRequireActor(deps: IdentityDeps): RequireActor {
  return async (request) => {
    const token = readSessionToken(request);
    const actor = token ? await resolveActor(deps, token) : null;
    if (!actor) throw new AppError('unauthenticated');
    return actor;
  };
}
