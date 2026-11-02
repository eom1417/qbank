import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { LandingScreen } from '../capabilities/about/LandingScreen.js';
import { LegalScreen } from '../capabilities/about/LegalScreen.js';
import { OutboxScreen } from '../capabilities/devtools/OutboxScreen.js';
import { ForgotPasswordScreen } from '../capabilities/identity/ForgotPasswordScreen.js';
import { ResetPasswordScreen } from '../capabilities/identity/ResetPasswordScreen.js';
import { useSession } from '../capabilities/identity/session.js';
import { SignInScreen } from '../capabilities/identity/SignInScreen.js';
import { SignUpScreen } from '../capabilities/identity/SignUpScreen.js';
import { BankScreen } from '../capabilities/library/BankScreen.js';
import { LibraryScreen } from '../capabilities/library/LibraryScreen.js';
import { MutedText } from '../design-system/index.js';
import { useI18n } from '../platform/i18n/i18n.js';
import { AppShell } from './AppShell.js';
import { SettingsPage } from './SettingsPage.js';

function Loading() {
  const { t } = useI18n();
  return <MutedText>{t('common.loading')}</MutedText>;
}

/** Private screens: a signed-out visitor is sent to sign-in (the server still enforces it). */
function Private({ children }: { children: ReactNode }) {
  const { state } = useSession();
  if (state.status === 'loading') return <Loading />;
  return state.status === 'signed-in' ? children : <Navigate to="/sign-in" replace />;
}

/** Sign-in/up screens: a signed-in account goes straight to its library. */
function Public({ children }: { children: ReactNode }) {
  const { state } = useSession();
  return state.status === 'signed-in' ? <Navigate to="/" replace /> : children;
}

/** `/` is the library for an account and the service description for a visitor (UI-01). */
function Home() {
  const { state } = useSession();
  if (state.status === 'loading') return <Loading />;
  return state.status === 'signed-in' ? <LibraryScreen /> : <LandingScreen />;
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Home /> },
      {
        path: '/banks/:bankId',
        element: (
          <Private>
            <BankScreen />
          </Private>
        ),
      },
      {
        path: '/settings',
        element: (
          <Private>
            <SettingsPage />
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
      {
        path: '/forgot-password',
        element: (
          <Public>
            <ForgotPasswordScreen />
          </Public>
        ),
      },
      { path: '/reset-password', element: <ResetPasswordScreen /> },
      { path: '/terms', element: <LegalScreen page="terms" /> },
      { path: '/privacy', element: <LegalScreen page="privacy" /> },
      { path: '/dev/outbox', element: <OutboxScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
