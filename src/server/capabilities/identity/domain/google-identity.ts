import type { Locale } from '../../../../contracts/identity.js';

/** The person an id_token from Google's token endpoint vouches for (M32, DEC-42). */
export interface GooglePerson {
  sub: string;
  /** Lower-cased; verified by Google. */
  email: string;
  name: string | null;
}

export interface ExpectedClaims {
  clientId: string;
  nonce: string;
  now: Date;
}

const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** OIDC Core 3.1.3.7: a list audience must hold this client and name it as the party. */
function forThisClient(claims: Record<string, unknown>, clientId: string): boolean {
  const { aud, azp } = claims;
  if (Array.isArray(aud)) return aud.includes(clientId) && azp === clientId;
  return aud === clientId;
}

function unexpired(claims: Record<string, unknown>, now: Date): boolean {
  return typeof claims['exp'] === 'number' && claims['exp'] * 1000 > now.getTime();
}

/**
 * The person, when the token's claims hold: Google issued it, for this client, for this very
 * sign-in (nonce), not expired, with an e-mail Google verified. The token came straight from
 * Google's token endpoint over TLS, so its claims are checked, not its signature (OIDC Core
 * 3.1.3.7). Anything else is null.
 */
export function personFromClaims(
  claims: Record<string, unknown>,
  expected: ExpectedClaims,
): GooglePerson | null {
  const checks = [
    ISSUERS.has(String(claims['iss'])),
    forThisClient(claims, expected.clientId),
    unexpired(claims, expected.now),
    claims['nonce'] === expected.nonce,
    claims['email_verified'] === true,
  ];
  const sub = text(claims['sub']);
  const email = text(claims['email'])?.toLowerCase();
  if (!checks.every(Boolean) || !sub || !email) return null;
  return { sub, email, name: text(claims['name']) };
}

/** Longest display name an account may have (the contract's limit). */
const NAME_MAX = 80;

/** The new account's name: Google's, else the part of the e-mail before the @. */
export function displayNameOf(person: GooglePerson): string {
  const name = person.name ?? person.email.split('@')[0] ?? person.email;
  return name.slice(0, NAME_MAX);
}

/** The browser's first language when QBank speaks it; Arabic otherwise. */
export function localeFrom(acceptLanguage: string | undefined): Locale {
  return /^\s*en\b/i.test(acceptLanguage ?? '') ? 'en' : 'ar';
}

/** Where to go after signing in: a path of this app only ("/x", never "//x" or "/\x"), else "/". */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || next.length > 512) return '/';
  if (!/^\/(?![/\\])[^\s\\]*$/.test(next)) return '/';
  const resolved = new URL(next, 'http://app.invalid');
  return resolved.origin === 'http://app.invalid' ? next : '/';
}
