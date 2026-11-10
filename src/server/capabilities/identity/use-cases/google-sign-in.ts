import type { Locale } from '../../../../contracts/identity.js';
import type { GoogleConfig } from '../../../platform/config/index.js';
import { exchangeCode } from '../adapters/google-client.js';
import type { PendingFlow } from '../adapters/google-flows.js';
import { defaultPreferences, type Account } from '../domain/account.js';
import { displayNameOf, personFromClaims, type GooglePerson } from '../domain/google-identity.js';
import type { SignedIn } from './accounts.js';
import type { IdentityDeps } from './deps.js';
import { issueSession } from './sessions.js';

export type GoogleSignInOutcome =
  | { kind: 'signed_in'; signedIn: SignedIn }
  /** A new person who did not accept the terms before leaving for Google. */
  | { kind: 'terms_required' }
  /** The e-mail belongs to an account already linked to another Google person. */
  | { kind: 'refused' };

export interface GoogleConsent {
  acceptTerms: boolean;
  locale: Locale;
}

/** The person Google vouches for after the consent screen, or null (M32, DEC-42). */
export async function personFromCode(
  google: GoogleConfig,
  flow: PendingFlow & { redirectUri: string },
  code: string,
  now: Date,
): Promise<GooglePerson | null> {
  const claims = await exchangeCode(google, flow, code);
  return claims && personFromClaims(claims, { clientId: google.clientId, nonce: flow.nonce, now });
}

/** An account made before Google sign-in, linked by the e-mail Google has now verified. */
async function linkByEmail(deps: IdentityDeps, person: GooglePerson) {
  const existing = await deps.accounts.findByEmail(person.email);
  if (!existing) return null;
  if (!(await deps.accounts.linkGoogle(existing.id, person.sub))) return 'refused' as const;
  // Nobody had verified this e-mail before: whoever was signed in to the account is signed out.
  await deps.sessions.deleteOthers(existing.id, null);
  return { ...existing, googleLinked: true };
}

async function createAccount(deps: IdentityDeps, person: GooglePerson, consent: GoogleConsent) {
  const account: Account = {
    id: deps.newId(),
    email: person.email,
    displayName: displayNameOf(person),
    preferences: defaultPreferences(consent.locale),
    googleLinked: true,
  };
  const outcome = await deps.accounts.insert({
    ...account,
    passwordHash: null,
    googleSub: person.sub,
    termsAcceptedAt: deps.clock.now(),
  });
  return outcome === 'created' ? account : ('refused' as const);
}

/**
 * Signs the person Google vouched for in: their linked account, else the account with their
 * e-mail (linked now), else a new account if they accepted the terms. Then a normal session.
 */
export async function signInWithGoogle(
  deps: IdentityDeps,
  person: GooglePerson,
  consent: GoogleConsent,
): Promise<GoogleSignInOutcome> {
  const account =
    (await deps.accounts.findByGoogleSub(person.sub)) ??
    (await linkByEmail(deps, person)) ??
    (consent.acceptTerms ? await createAccount(deps, person, consent) : 'terms_required');
  if (account === 'refused' || account === 'terms_required') return { kind: account };
  return {
    kind: 'signed_in',
    signedIn: { account, session: await issueSession(deps, account.id) },
  };
}
