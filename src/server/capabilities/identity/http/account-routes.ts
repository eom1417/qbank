import type { FastifyInstance } from 'fastify';
import {
  ChangePasswordRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
  UpdateAccountRequest,
} from '../../../../contracts/identity.js';
import { AppError } from '../../../platform/errors/index.js';
import { createAttemptLimiter } from '../../../platform/http/attempts.js';
import { parseInput } from '../../../platform/http/validate.js';
import { updateAccount } from '../use-cases/accounts.js';
import {
  changePassword,
  confirmPasswordReset,
  requestPasswordReset,
} from '../use-cases/passwords.js';
import { toAccountResponse } from './presenters.js';
import type { IdentityRouteOptions } from './routes.js';
import { readSessionToken } from './session-cookie.js';

/** Account settings (FR-02-005, UI-25), in both modes. */
export function registerAccountRoutes(app: FastifyInstance, options: IdentityRouteOptions) {
  const { deps, requireActor } = options;
  app.patch('/api/account', async (request) => {
    const actor = await requireActor(request);
    const changes = parseInput(UpdateAccountRequest, request.body);
    return toAccountResponse(await updateAccount(deps, actor, changes));
  });
}

/** Password management (UI-02): accounts mode only; a local install has no passwords. */
export function registerPasswordRoutes(app: FastifyInstance, options: IdentityRouteOptions) {
  const { deps, requireActor } = options;
  // Reset emails per inbox and per caller: enough for a person, too few to flood anyone.
  const hour = { windowMs: 60 * 60_000, now: () => deps.clock.now() };
  const perInbox = createAttemptLimiter({ max: 5, ...hour });
  const perCaller = createAttemptLimiter({ max: 30, ...hour });

  app.post('/api/account/password', async (request, reply) => {
    const actor = await requireActor(request);
    const token = readSessionToken(request);
    if (!token) throw new AppError('unauthenticated');
    await changePassword(deps, actor, token, parseInput(ChangePasswordRequest, request.body));
    return reply.status(204).send();
  });

  // The Origin header was already checked by the origin guard, so it is the app's own origin.
  app.post('/api/auth/password-reset/request', async (request, reply) => {
    const { email } = parseInput(PasswordResetRequest, request.body);
    // The link in the email points at the configured app, never at a header the caller sent.
    if (!options.publicOrigin) throw new AppError('forbidden_origin');
    if (perInbox.blocked(email) || perCaller.blocked(request.ip))
      throw new AppError('too_many_attempts');
    perInbox.fail(email);
    perCaller.fail(request.ip);
    await requestPasswordReset(deps, email, options.publicOrigin);
    return reply.status(202).send();
  });

  app.post('/api/auth/password-reset/confirm', async (request, reply) => {
    await confirmPasswordReset(deps, parseInput(PasswordResetConfirm, request.body));
    return reply.status(204).send();
  });
}
