import { Link, Outlet } from 'react-router';
import { Button, PageShell, useTheme, type ThemePreference } from '../design-system/index.js';
import { useSession } from '../capabilities/identity/session.js';
import { useI18n } from '../platform/i18n/i18n.js';

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export function AppShell() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { state, signOut } = useSession();
  const actions = (
    <>
      <Button
        variant="ghost"
        lang={locale === 'ar' ? 'en' : 'ar'}
        onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      >
        {t('shell.language')}
      </Button>
      <Button variant="ghost" onClick={() => setTheme(NEXT_THEME[theme])}>
        {t(`shell.theme.${theme}`)}
      </Button>
      {state.status === 'signed-in' && (
        <Button variant="secondary" onClick={() => void signOut()}>
          {t('shell.signOut')}
        </Button>
      )}
    </>
  );
  const brand = (
    <Link className="qb-shell__brand" to="/">
      {t('app.name')}
    </Link>
  );
  return (
    <PageShell brand={brand} actions={actions}>
      <Outlet />
    </PageShell>
  );
}
