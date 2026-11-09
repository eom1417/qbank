import { notFound } from '../../../platform/errors/index.js';
import { hashToken } from '../adapters/tokens.js';
import type { OpenReset } from '../adapters/password-reset-repository.js';
import { resetLink, resetTokenIn } from '../domain/password-reset.js';
import type { IdentityDeps } from './deps.js';
import { issueReset } from './passwords.js';

/**
 * Password resets handed over by the operator (M31, B4, DEC-40): the server sends no e-mail, so
 * the operator passes the link on by hand. The operator never sees or sets a password.
 */
export interface ResetRequest {
  accountId: string;
  email: string;
  displayName: string;
  requestedAt: Date;
  expiresAt: Date;
  expired: boolean;
}

export interface HandedLink {
  link: string;
  expiresAt: Date;
  /** True when the request had expired (or its message was gone) and a new link was made. */
  fresh: boolean;
}

/** Every account whose newest "forgot password" request is still unused, newest first. */
export async function listResetRequests(deps: IdentityDeps): Promise<ResetRequest[]> {
  const now = deps.clock.now();
  return (await deps.resets.listOpen()).map((open) => ({
    accountId: open.accountId,
    email: open.email,
    displayName: open.displayName,
    requestedAt: open.createdAt,
    expiresAt: open.expiresAt,
    expired: open.expiresAt <= now,
  }));
}

/** The token of the request's own message in the outbox, matched by its stored hash. */
async function tokenInOutbox(deps: IdentityDeps, open: OpenReset): Promise<string | null> {
  for (const text of await deps.outbox.recentTo(open.email)) {
    const token = resetTokenIn(text);
    if (token && hashToken(token) === open.tokenHash) return token;
  }
  return null;
}

/**
 * The link for an account that asked for one: its own link while it is valid, otherwise a new
 * one (no need for the user to ask again). An account that asked for nothing gets nothing.
 */
export async function resetLinkFor(
  deps: IdentityDeps,
  accountId: string,
  appOrigin: string,
): Promise<HandedLink> {
  const open = await deps.resets.findOpen(accountId);
  if (!open) throw notFound();
  const token = open.expiresAt > deps.clock.now() ? await tokenInOutbox(deps, open) : null;
  if (token) return { link: resetLink(appOrigin, token), expiresAt: open.expiresAt, fresh: false };
  const account = await deps.accounts.findById(accountId);
  if (!account) throw notFound();
  return { ...(await issueReset(deps, account, appOrigin)), fresh: true };
}
