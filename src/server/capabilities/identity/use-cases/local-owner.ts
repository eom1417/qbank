import type { Locale } from '../../../../contracts/identity.js';
import { AppError } from '../../../platform/errors/index.js';
import { generateToken, sameToken } from '../adapters/tokens.js';
import { defaultPreferences, type Account } from '../domain/account.js';
import type { IdentityDeps } from './deps.js';
import { issueSession } from './sessions.js';
import type { SignedIn } from './accounts.js';

/** The one owner of a local install (DEC-31). It has no password: browsers pair instead. */
const LOCAL_EMAIL = 'owner@qbank.local';

async function localOwner(deps: IdentityDeps, locale: Locale): Promise<Account> {
  const existing = await deps.accounts.findCredentials(LOCAL_EMAIL);
  const found = existing && (await deps.accounts.findById(existing.id));
  if (found) return found;
  const account: Account = {
    id: deps.newId(),
    email: LOCAL_EMAIL,
    displayName: 'QBank',
    preferences: defaultPreferences(locale),
  };
  // A random password nobody knows: password sign-in can never reach this account.
  const passwordHash = await deps.passwords.hash(generateToken());
  const outcome = await deps.accounts.insert({
    ...account,
    passwordHash,
    termsAcceptedAt: deps.clock.now(),
  });
  // Two first visits at once: the other one created it.
  return outcome === 'created' ? account : localOwner(deps, locale);
}

export interface PairingProof {
  /** The request came straight from this computer (no proxy), to a loopback host name. */
  fromThisComputer: boolean;
  presented: string | undefined;
  expected: string;
}

/** Pairs a browser with the local owner: from this computer, or with the pairing code. */
export async function pairBrowser(
  deps: IdentityDeps,
  proof: PairingProof,
  locale: Locale = 'ar',
): Promise<SignedIn> {
  const codeMatches = proof.presented !== undefined && sameToken(proof.presented, proof.expected);
  if (!proof.fromThisComputer && !codeMatches) throw new AppError('pairing_required');
  const account = await localOwner(deps, locale);
  return { account, session: await issueSession(deps, account.id) };
}
