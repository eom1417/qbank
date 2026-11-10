import { DEFAULT_SKIN, type AccountPreferences } from '../../../../contracts/identity.js';

export interface Account {
  id: string;
  email: string;
  displayName: string;
  preferences: AccountPreferences;
  /** Confirmed from the server's shell as the operator's own account (DEC-40). */
  operatorConfirmed?: boolean;
  /** Linked to a Google account, whose verified e-mail it carries (M32, DEC-42). */
  googleLinked?: boolean;
}

/** Defaults for a new account; the locale comes from the sign-up screen. */
export const defaultPreferences = (locale: AccountPreferences['locale']): AccountPreferences => ({
  locale,
  theme: 'system',
  skin: DEFAULT_SKIN,
  defaultSessionSize: 20,
  explanationMode: 'after_answer',
  reviewReminders: 'off',
});

/** The authenticated caller. Every owner-scoped query takes its accountId. */
export interface Actor {
  accountId: string;
}
