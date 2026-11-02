import type { Clock } from '../../../platform/clock.js';
import type { AccountRepository } from '../adapters/account-repository.js';
import type { PasswordHasher } from '../adapters/password-hasher.js';
import type { SessionRepository } from '../adapters/session-repository.js';

export interface IdentityDeps {
  accounts: AccountRepository;
  sessions: SessionRepository;
  passwords: PasswordHasher;
  clock: Clock;
  newId: () => string;
  sessionTtlDays: number;
}
