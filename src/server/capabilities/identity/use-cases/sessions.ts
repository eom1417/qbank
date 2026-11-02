import { generateToken, hashToken } from '../adapters/tokens.js';
import type { Actor } from '../domain/account.js';
import { sessionExpiresAt } from '../domain/session.js';
import type { IdentityDeps } from './deps.js';

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export async function issueSession(deps: IdentityDeps, accountId: string): Promise<IssuedSession> {
  const token = generateToken();
  const expiresAt = sessionExpiresAt(deps.clock.now(), deps.sessionTtlDays);
  await deps.sessions.insert(hashToken(token), accountId, expiresAt);
  return { token, expiresAt };
}

export async function resolveActor(deps: IdentityDeps, token: string): Promise<Actor | null> {
  const accountId = await deps.sessions.findAccountId(hashToken(token), deps.clock.now());
  return accountId ? { accountId } : null;
}

export async function endSession(deps: IdentityDeps, token: string): Promise<void> {
  await deps.sessions.delete(hashToken(token));
}
