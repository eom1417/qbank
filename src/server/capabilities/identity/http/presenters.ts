import type { AccountResponse } from '../../../../contracts/identity.js';
import type { Account } from '../domain/account.js';

export const toAccountResponse = (account: Account): AccountResponse => ({
  id: account.id,
  email: account.email,
  displayName: account.displayName,
  preferences: {
    locale: account.preferences.locale,
    theme: account.preferences.theme,
    defaultSessionSize: account.preferences.defaultSessionSize,
    explanationMode: account.preferences.explanationMode,
  },
});
