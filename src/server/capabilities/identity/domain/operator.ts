import type { Account } from './account.js';

/** How the server's operator proves the declared e-mail is theirs. */
export interface OperatorDeclaration {
  email: string | null;
  /** Google sign-in (M32, DEC-42): Google verified the e-mail, so a Google link is proof. */
  provenByGoogle: boolean;
}

const proven = (account: Account, declared: OperatorDeclaration): boolean =>
  account.operatorConfirmed === true || (declared.provenByGoogle && account.googleLinked === true);

/**
 * The server's operator (DEC-40): the account whose e-mail the configuration declares AND that
 * proved it: confirmed from the server's shell or, on a Google server, signed in with Google. The
 * e-mail alone grants nothing, because anyone with the link could sign up with it before the owner
 * does. E-mail case never matters.
 */
export const isOperator = (account: Account, declared: OperatorDeclaration): boolean =>
  declared.email !== null &&
  proven(account, declared) &&
  account.email.toLowerCase() === declared.email.toLowerCase();
