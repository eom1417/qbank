import type { SignInRequest, SignUpRequest } from '../../../../contracts/identity.js';
import { AppError } from '../../../platform/errors/index.js';
import type { Account, Actor } from '../domain/account.js';
import type { IdentityDeps } from './deps.js';
import { issueSession, type IssuedSession } from './sessions.js';

export interface SignedIn {
  account: Account;
  session: IssuedSession;
}

// Verifying against a real hash for unknown emails keeps response time independent of
// whether the account exists (no user enumeration through timing).
let decoyHash: Promise<string> | undefined;
const decoy = (deps: IdentityDeps): Promise<string> =>
  (decoyHash ??= deps.passwords.hash('decoy-password-for-timing'));

async function loadAccount(deps: IdentityDeps, id: string): Promise<Account> {
  const account = await deps.accounts.findById(id);
  if (!account) throw new AppError('unauthenticated');
  return account;
}

export async function signUp(deps: IdentityDeps, input: SignUpRequest): Promise<SignedIn> {
  const account: Account = {
    id: deps.newId(),
    email: input.email,
    displayName: input.displayName,
    locale: input.locale,
    theme: 'system',
  };
  const passwordHash = await deps.passwords.hash(input.password);
  const termsAcceptedAt = deps.clock.now();
  const outcome = await deps.accounts.insert({ ...account, passwordHash, termsAcceptedAt });
  if (outcome === 'email_taken') throw new AppError('email_taken', { email: 'taken' });
  return { account, session: await issueSession(deps, account.id) };
}

export async function signIn(deps: IdentityDeps, input: SignInRequest): Promise<SignedIn> {
  const credentials = await deps.accounts.findCredentials(input.email);
  const hashToCheck = credentials?.passwordHash ?? (await decoy(deps));
  const matches = await deps.passwords.verify(hashToCheck, input.password);
  if (!credentials || !matches) throw new AppError('invalid_credentials');
  const account = await loadAccount(deps, credentials.id);
  return { account, session: await issueSession(deps, account.id) };
}

export const getAccount = (deps: IdentityDeps, actor: Actor): Promise<Account> =>
  loadAccount(deps, actor.accountId);
