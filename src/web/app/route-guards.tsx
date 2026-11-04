import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { LandingScreen } from '../capabilities/about/LandingScreen.js';
import { PairScreen } from '../capabilities/identity/PairScreen.js';
import { useSession } from '../capabilities/identity/session.js';
import { LibraryScreen } from '../capabilities/library/LibraryScreen.js';
import { MutedText } from '../design-system/index.js';
import { useI18n } from '../platform/i18n/i18n.js';

function Loading() {
  const { t } = useI18n();
  return <MutedText>{t('common.loading')}</MutedText>;
}

/**
 * Private screens: a signed-out visitor is sent to sign-in, or in local mode to pairing on `/`
 * (the server still enforces it).
 */
export function Private({ children }: { children: ReactNode }) {
  const { state, mode } = useSession();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'signed-in') return children;
  return <Navigate to={mode === 'local' ? '/' : '/sign-in'} replace />;
}

/** Sign-in/up screens: none in local mode; a signed-in account goes straight to its library. */
export function Public({ children }: { children: ReactNode }) {
  const { state, mode } = useSession();
  const away = state.status === 'signed-in' || mode === 'local';
  return away ? <Navigate to="/" replace /> : children;
}

/**
 * `/` is the library when signed in; otherwise the service description (UI-01), or in local mode
 * the pairing screen (DEC-31).
 */
export function Home() {
  const { state, mode } = useSession();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'signed-in') return <LibraryScreen />;
  return mode === 'local' ? <PairScreen /> : <LandingScreen />;
}
