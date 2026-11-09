import type { Clock } from '../../../platform/clock.js';
import type { Mailer } from '../../../platform/mail/index.js';
import type { AccountRepository } from '../adapters/account-repository.js';
import type { PasswordHasher } from '../adapters/password-hasher.js';
import type { PasswordResetRepository } from '../adapters/password-reset-repository.js';
import type { ResetOutbox } from '../adapters/reset-outbox.js';
import type { SessionRepository } from '../adapters/session-repository.js';

export interface IdentityDeps {
  accounts: AccountRepository;
  sessions: SessionRepository;
  resets: PasswordResetRepository;
  outbox: ResetOutbox;
  passwords: PasswordHasher;
  mailer: Mailer;
  clock: Clock;
  newId: () => string;
  sessionTtlDays: number;
  /** The declared operator's e-mail (DEC-40); null when the server declares none. */
  operatorEmail: string | null;
}
