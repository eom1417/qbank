import type { Locale, Theme } from '../../../../contracts/identity.js';

export interface Account {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
  theme: Theme;
}

/** The authenticated caller. Every owner-scoped query takes its accountId. */
export interface Actor {
  accountId: string;
}
