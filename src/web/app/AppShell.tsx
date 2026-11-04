import { Link, Outlet } from 'react-router';
import { Button, PageShell, useTheme, type ThemePreference } from '../design-system/index.js';
import { useSession } from '../capabilities/identity/session.js';
import { useI18n } from '../platform/i18n/i18n.js';

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

/** Language and theme switches: applied at once, and saved to the account when signed in. */
function PreferenceSwitches() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { state, updateAccount } = useSession();
  const save = (changes: Parameters<typeof updateAccount>[0]) => {
    if (state.status === 'signed-in') void updateAccount(changes).catch(() => undefined);
  };
  const nextLocale = locale === 'ar' ? 'en' : 'ar';
  const nextTheme = NEXT_THEME[theme];
  return (
    <>
      <Button
        variant="ghost"
        lang={nextLocale}
        onClick={() => (setLocale(nextLocale), save({ locale: nextLocale }))}
      >
        {t('shell.language')}
      </Button>
      <Button variant="ghost" onClick={() => (setTheme(nextTheme), save({ theme: nextTheme }))}>
        {t(`shell.theme.${theme}`)}
      </Button>
    </>
  );
}

/** Navigation; a local install has no sign-in or sign-out, only paired browsers (DEC-31). */
function AccountLinks() {
  const { t } = useI18n();
  const { state, mode, signOut } = useSession();
  if (state.status === 'loading' || mode === null) return null;
  if (state.status === 'signed-out') {
    return mode === 'local' ? null : <Link to="/sign-in">{t('shell.nav.signIn')}</Link>;
  }
  return (
    <>
      <Link to="/">{t('shell.nav.library')}</Link>
      <Link to="/settings">{t('shell.nav.settings')}</Link>
      {mode === 'accounts' && (
        <Button variant="secondary" onClick={() => void signOut()}>
          {t('shell.signOut')}
        </Button>
      )}
    </>
  );
}

export function AppShell() {
  const { t } = useI18n();
  const brand = (
    <Link className="qb-shell__brand" to="/">
      {t('app.name')}
    </Link>
  );
  const actions = (
    <>
      <AccountLinks />
      <PreferenceSwitches />
    </>
  );
  return (
    <PageShell brand={brand} actions={actions}>
      <Outlet />
    </PageShell>
  );
}
