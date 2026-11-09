import type { FastifyRequest } from 'fastify';
import { AppError } from '../../../platform/errors/index.js';
import type { Actor } from '../domain/account.js';
import { isOperator } from '../domain/operator.js';
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

/**
 * The gate of the operator's console (DEC-40): a session of the declared operator, or 403
 * `operator_only` (401 without a session). Checked on every request, so a changed declaration
 * takes effect at once.
 */
export function createRequireOperator(
  deps: IdentityDeps,
  requireActor: RequireActor,
): RequireActor {
  return async (request) => {
    const actor = await requireActor(request);
    const account = await deps.accounts.findById(actor.accountId);
    if (!account || !isOperator(account, deps.operatorEmail)) throw new AppError('operator_only');
    return actor;
  };
}
