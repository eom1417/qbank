import type { AccountResponse } from '../../../../contracts/identity.js';
import type { Account } from '../domain/account.js';
import { isOperator, type OperatorDeclaration } from '../domain/operator.js';

export const toAccountResponse = (account: Account, isOperator: boolean): AccountResponse => ({
  id: account.id,
  email: account.email,
  displayName: account.displayName,
  preferences: {
    locale: account.preferences.locale,
    theme: account.preferences.theme,
    skin: account.preferences.skin,
    defaultSessionSize: account.preferences.defaultSessionSize,
    explanationMode: account.preferences.explanationMode,
    reviewReminders: account.preferences.reviewReminders,
  },
  isOperator,
});

/** The account as its owner sees it, flagged when it is the server's operator (DEC-40). */
export const accountView = (deps: { operator: OperatorDeclaration }, account: Account) =>
  toAccountResponse(account, isOperator(account, deps.operator));
