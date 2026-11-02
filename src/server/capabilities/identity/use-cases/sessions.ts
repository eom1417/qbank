import { generateSessionToken, hashSessionToken } from '../adapters/session-tokens.js';
import type { Actor } from '../domain/account.js';
import { sessionExpiresAt } from '../domain/session.js';
import type { IdentityDeps } from './deps.js';

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export async function issueSession(deps: IdentityDeps, accountId: string): Promise<IssuedSession> {
  const token = generateSessionToken();
  const expiresAt = sessionExpiresAt(deps.clock.now(), deps.sessionTtlDays);
  await deps.sessions.insert(hashSessionToken(token), accountId, expiresAt);
  return { token, expiresAt };
}

export async function resolveActor(deps: IdentityDeps, token: string): Promise<Actor | null> {
  const accountId = await deps.sessions.findAccountId(hashSessionToken(token), deps.clock.now());
  return accountId ? { accountId } : null;
}

export async function endSession(deps: IdentityDeps, token: string): Promise<void> {
  await deps.sessions.delete(hashSessionToken(token));
}
