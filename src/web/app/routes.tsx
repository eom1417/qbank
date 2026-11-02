import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { MutedText } from '../design-system/index.js';
import { useSession } from '../capabilities/identity/session.js';
import { SignInScreen } from '../capabilities/identity/SignInScreen.js';
import { SignUpScreen } from '../capabilities/identity/SignUpScreen.js';
import { BankScreen } from '../capabilities/library/BankScreen.js';
import { LibraryScreen } from '../capabilities/library/LibraryScreen.js';
import { useI18n } from '../platform/i18n/i18n.js';
import { AppShell } from './AppShell.js';

/** Private screens: a signed-out visitor is sent to sign-in (the server still enforces it). */
function Private({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const { t } = useI18n();
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  return state.status === 'signed-in' ? children : <Navigate to="/sign-in" replace />;
}

/** Sign-in/up screens: a signed-in account goes straight to its library. */
function Public({ children }: { children: ReactNode }) {
  const { state } = useSession();
  return state.status === 'signed-in' ? <Navigate to="/" replace /> : children;
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        path: '/',
        element: (
          <Private>
            <LibraryScreen />
          </Private>
        ),
      },
      {
        path: '/banks/:bankId',
        element: (
          <Private>
            <BankScreen />
          </Private>
        ),
      },
      {
        path: '/sign-in',
        element: (
          <Public>
            <SignInScreen />
          </Public>
        ),
      },
      {
        path: '/sign-up',
        element: (
          <Public>
            <SignUpScreen />
          </Public>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
