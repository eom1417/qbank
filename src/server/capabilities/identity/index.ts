import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import type { Mailer } from '../../platform/mail/index.js';
import { newId } from '../../platform/ids.js';
import { createAccountRepository } from './adapters/account-repository.js';
import { argon2Hasher } from './adapters/password-hasher.js';
import { createPasswordResetRepository } from './adapters/password-reset-repository.js';
import { createSessionRepository } from './adapters/session-repository.js';
import { createRequireActor, type RequireActor } from './http/require-actor.js';
import { registerIdentityRoutes } from './http/routes.js';

export type { Actor } from './domain/account.js';
export type { RequireActor } from './http/require-actor.js';
export { toAccountResponse } from './http/presenters.js';

export interface IdentityModule {
  requireActor: RequireActor;
  register(app: FastifyInstance): void;
}

interface IdentitySettings {
  db: Db;
  clock: Clock;
  mailer: Mailer;
  sessionTtlDays: number;
  cookieSecure: boolean;
}

export function createIdentity(settings: IdentitySettings): IdentityModule {
  const deps = {
    accounts: createAccountRepository(settings.db),
    sessions: createSessionRepository(settings.db),
    resets: createPasswordResetRepository(settings.db),
    passwords: argon2Hasher,
    mailer: settings.mailer,
    clock: settings.clock,
    newId,
    sessionTtlDays: settings.sessionTtlDays,
  };
  const requireActor = createRequireActor(deps);
  return {
    requireActor,
    register: (app) =>
      registerIdentityRoutes(app, { deps, requireActor, cookieSecure: settings.cookieSecure }),
  };
}
