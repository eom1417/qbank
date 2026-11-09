import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import { AppError } from '../../platform/errors/index.js';
import type { Mailer } from '../../platform/mail/index.js';
import { newId } from '../../platform/ids.js';
import { createAccountRepository, type AccountContact } from './adapters/account-repository.js';
import { argon2Hasher } from './adapters/password-hasher.js';
import { createPasswordResetRepository } from './adapters/password-reset-repository.js';
import { createResetOutbox } from './adapters/reset-outbox.js';
import { createSessionRepository } from './adapters/session-repository.js';
import {
  createRequireActor,
  createRequireOperator,
  type RequireActor,
} from './http/require-actor.js';
import { registerIdentityRoutes } from './http/routes.js';
import { createPairingCode, savePairingToken } from './adapters/pairing-token.js';
import {
  listResetRequests,
  resetLinkFor,
  type HandedLink,
  type ResetRequest,
} from './use-cases/operator-resets.js';

export type { Actor } from './domain/account.js';
export type { RequireActor } from './http/require-actor.js';
export { toAccountResponse } from './http/presenters.js';
export { loadPairingToken } from './adapters/pairing-token.js';

/** What the operator's console may learn about people (M31, DEC-40): contacts and resets only. */
export interface OperatorDirectory {
  /** E-mail and name of each account found, by id (what the operator may see of a person). */
  contactsOf(ids: readonly string[]): Promise<Map<string, AccountContact>>;
  /** Accounts waiting for a reset link from the operator (M31, B4). */
  resetRequests(): Promise<ResetRequest[]>;
  /** The reset link the operator passes on; not_found unless the account asked for one. */
  resetLink(accountId: string): Promise<HandedLink>;
}

export interface IdentityModule extends OperatorDirectory {
  requireActor: RequireActor;
  /** The operator's gate (DEC-40): 403 `operator_only` for anyone but the declared operator. */
  requireOperator: RequireActor;
  /** Deletes the account and all it owns (FR-19-006); the caller erases stored files first. */
  deleteAccount(accountId: string): Promise<boolean>;
  register(app: FastifyInstance): void;
}

interface IdentitySettings {
  db: Db;
  clock: Clock;
  mailer: Mailer;
  sessionTtlDays: number;
  cookieSecure: boolean;
  /** Local mode (DEC-31): the install's pairing code. Null runs accounts mode. */
  pairingToken: string | null;
  /** Where a replaced pairing code is saved (the data directory). */
  dataDir: string;
  requirePairingCode: boolean;
  localPeers: readonly string[];
  publicOrigin: string | null;
  /** The server's declared operator (DEC-40, `config.operator`); both null on a local install. */
  operator: { email: string | null; name: string | null };
}

function identityDeps(settings: IdentitySettings) {
  return {
    accounts: createAccountRepository(settings.db),
    sessions: createSessionRepository(settings.db),
    resets: createPasswordResetRepository(settings.db),
    outbox: createResetOutbox(settings.db),
    passwords: argon2Hasher,
    mailer: settings.mailer,
    clock: settings.clock,
    newId,
    sessionTtlDays: settings.sessionTtlDays,
    operatorEmail: settings.operator.email,
  };
}

export function createIdentity(settings: IdentitySettings): IdentityModule {
  const deps = identityDeps(settings);
  const requireActor = createRequireActor(deps);
  return {
    requireActor,
    requireOperator: createRequireOperator(deps, requireActor),
    deleteAccount: (accountId) => deps.accounts.delete(accountId),
    contactsOf: (ids) => deps.accounts.contactsOf(ids),
    resetRequests: () => listResetRequests(deps),
    resetLink: (accountId) => {
      // Links point at the configured app, never at a header the caller sent.
      if (!settings.publicOrigin) throw new AppError('forbidden_origin');
      return resetLinkFor(deps, accountId, settings.publicOrigin);
    },
    register: (app) =>
      registerIdentityRoutes(app, {
        deps,
        requireActor,
        cookieSecure: settings.cookieSecure,
        pairing:
          settings.pairingToken === null
            ? null
            : createPairingCode(settings.pairingToken, (code) =>
                savePairingToken(settings.dataDir, code),
              ),
        requirePairingCode: settings.requirePairingCode,
        localPeers: settings.localPeers,
        publicOrigin: settings.publicOrigin,
        operatorName: settings.operator.name,
      }),
  };
}
