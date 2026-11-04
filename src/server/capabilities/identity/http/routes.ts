import type { FastifyInstance } from 'fastify';
import {
  SignInRequest,
  SignUpRequest,
  type AppMetaResponse,
} from '../../../../contracts/identity.js';
import { parseInput } from '../../../platform/http/validate.js';
import { getAccount, signIn, signUp } from '../use-cases/accounts.js';
import type { IdentityDeps } from '../use-cases/deps.js';
import { endSession } from '../use-cases/sessions.js';
import { registerAccountRoutes, registerPasswordRoutes } from './account-routes.js';
import { registerLocalRoutes } from './local-routes.js';
import { toAccountResponse } from './presenters.js';
import type { RequireActor } from './require-actor.js';
import { clearSessionCookie, readSessionToken, setSessionCookie } from './session-cookie.js';

export interface IdentityRouteOptions {
  deps: IdentityDeps;
  requireActor: RequireActor;
  cookieSecure: boolean;
  /** Local mode when set: the install's pairing code (DEC-31). Accounts mode otherwise. */
  pairingToken: string | null;
}

/** Sign-up and password sign-in exist only in accounts mode. */
function registerSignInRoutes(app: FastifyInstance, options: IdentityRouteOptions) {
  const { deps, cookieSecure } = options;
  app.post('/api/auth/sign-up', async (request, reply) => {
    const { account, session } = await signUp(deps, parseInput(SignUpRequest, request.body));
    setSessionCookie(reply, session, cookieSecure);
    return reply.status(201).send(toAccountResponse(account));
  });

  app.post('/api/auth/sign-in', async (request, reply) => {
    const { account, session } = await signIn(deps, parseInput(SignInRequest, request.body));
    setSessionCookie(reply, session, cookieSecure);
    return toAccountResponse(account);
  });
  registerPasswordRoutes(app, options);
}

export function registerIdentityRoutes(app: FastifyInstance, options: IdentityRouteOptions) {
  const { deps, requireActor, cookieSecure, pairingToken } = options;
  const meta: AppMetaResponse = { mode: pairingToken === null ? 'accounts' : 'local' };
  app.get('/api/meta', async () => meta);
  if (pairingToken === null) registerSignInRoutes(app, options);
  else registerLocalRoutes(app, { deps, requireActor, pairingToken, cookieSecure });

  app.post('/api/auth/sign-out', async (request, reply) => {
    const token = readSessionToken(request);
    if (token) await endSession(deps, token);
    clearSessionCookie(reply, cookieSecure);
    return reply.status(204).send();
  });

  app.get('/api/auth/me', async (request) => {
    const actor = await requireActor(request);
    return toAccountResponse(await getAccount(deps, actor));
  });

  registerAccountRoutes(app, options);
}
