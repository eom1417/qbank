import type { AccountResponse } from '../../../../contracts/identity.js';
import type { Account } from '../domain/account.js';

export const toAccountResponse = (account: Account): AccountResponse => ({
  id: account.id,
  email: account.email,
  displayName: account.displayName,
  locale: account.locale,
  theme: account.theme,
});
