import type {
  ChangePasswordRequest,
  PasswordResetConfirm,
} from '../../../../contracts/identity.js';
import { AppError } from '../../../platform/errors/index.js';
import { generateToken, hashToken } from '../adapters/tokens.js';
import type { Account, Actor } from '../domain/account.js';
import { resetEmail, resetExpiresAt, resetLink } from '../domain/password-reset.js';
import type { IdentityDeps } from './deps.js';

/**
 * Sends a reset link when the account exists. The caller always gets the same answer,
 * so this endpoint cannot be used to discover which e-mails have accounts.
 */
export async function requestPasswordReset(deps: IdentityDeps, email: string, appOrigin: string) {
  const credentials = await deps.accounts.findCredentials(email);
  if (!credentials) return;
  const account = await deps.accounts.findById(credentials.id);
  if (account) await issueReset(deps, account, appOrigin);
}

/** Writes a new one-hour reset for the account and mails its link; returns the link (DEC-40). */
export async function issueReset(deps: IdentityDeps, account: Account, appOrigin: string) {
  const token = generateToken();
  const expiresAt = resetExpiresAt(deps.clock.now());
  await deps.resets.insert(hashToken(token), account.id, expiresAt);
  const message = resetEmail(account.preferences.locale, appOrigin, token);
  await deps.mailer.send({ to: account.email, ...message });
  return { link: resetLink(appOrigin, token), expiresAt };
}

/** Sets a new password from a one-time link and signs every device out (revocation). */
export async function confirmPasswordReset(deps: IdentityDeps, input: PasswordResetConfirm) {
  const accountId = await deps.resets.consume(hashToken(input.token), deps.clock.now());
  if (!accountId) throw new AppError('invalid_token');
  await deps.accounts.setPasswordHash(accountId, await deps.passwords.hash(input.password));
  await deps.sessions.deleteOthers(accountId, null);
}

/** Changes the password after re-checking the current one; other devices are signed out. */
export async function changePassword(
  deps: IdentityDeps,
  actor: Actor,
  currentSessionToken: string,
  input: ChangePasswordRequest,
) {
  const currentHash = await deps.accounts.findPasswordHash(actor.accountId);
  const matches = currentHash && (await deps.passwords.verify(currentHash, input.currentPassword));
  if (!matches) throw new AppError('validation_failed', { currentPassword: 'incorrect' });
  await deps.accounts.setPasswordHash(
    actor.accountId,
    await deps.passwords.hash(input.newPassword),
  );
  await deps.sessions.deleteOthers(actor.accountId, hashToken(currentSessionToken));
}
