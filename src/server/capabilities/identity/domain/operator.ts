import type { Account } from './account.js';

/**
 * The server's operator (DEC-40): the account whose e-mail the configuration declares AND that was
 * confirmed from the server's shell. The e-mail alone grants nothing, because anyone with the link
 * could sign up with it before the owner does. E-mail case never matters.
 */
export const isOperator = (account: Account, operatorEmail: string | null): boolean =>
  operatorEmail !== null &&
  account.operatorConfirmed === true &&
  account.email.toLowerCase() === operatorEmail.toLowerCase();
