import type { Clock } from '../../../platform/clock.js';
import type { Mailer } from '../../../platform/mail/index.js';
import type { AccountRepository } from '../adapters/account-repository.js';
import type { PasswordHasher } from '../adapters/password-hasher.js';
import type { PasswordResetRepository } from '../adapters/password-reset-repository.js';
import type { SessionRepository } from '../adapters/session-repository.js';

export interface IdentityDeps {
  accounts: AccountRepository;
  sessions: SessionRepository;
  resets: PasswordResetRepository;
  passwords: PasswordHasher;
  mailer: Mailer;
  clock: Clock;
  newId: () => string;
  sessionTtlDays: number;
}
