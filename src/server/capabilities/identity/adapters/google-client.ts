import { createHash } from 'node:crypto';
import type { GoogleConfig } from '../../../platform/config/index.js';

/** What the authorization request carries so the callback can be tied back to it. */
export interface AuthorizationRequest {
  redirectUri: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** PKCE S256 (RFC 7636): the challenge Google keeps until the verifier is shown. */
const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** Google's consent screen for this sign-in: code flow, OpenID scopes, PKCE, account picker. */
export function authorizationUrl(google: GoogleConfig, request: AuthorizationRequest): string {
  const url = new URL(google.authUrl);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: google.clientId,
    redirect_uri: request.redirectUri,
    scope: 'openid email profile',
    state: request.state,
    nonce: request.nonce,
    code_challenge: challengeOf(request.codeVerifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

/** The JSON payload of a JWT, unverified; null when it is not shaped like one. */
function payloadOf(idToken: unknown): Record<string, unknown> | null {
  const parts = typeof idToken === 'string' ? idToken.split('.') : [];
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const isObject = typeof payload === 'object' && payload !== null && !Array.isArray(payload);
    return isObject ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Trades the code for tokens at Google's token endpoint and returns the id_token's claims, or
 * null on any failure. Neither the code nor any token is ever logged.
 */
export async function exchangeCode(
  google: GoogleConfig,
  request: Pick<AuthorizationRequest, 'redirectUri' | 'codeVerifier'>,
  code: string,
): Promise<Record<string, unknown> | null> {
  const body = new URLSearchParams({
    code,
    client_id: google.clientId,
    client_secret: google.clientSecret,
    redirect_uri: request.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: request.codeVerifier,
  });
  try {
    const response = await fetch(google.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const tokens = (await response.json()) as { id_token?: unknown };
    return payloadOf(tokens.id_token);
  } catch {
    return null;
  }
}
