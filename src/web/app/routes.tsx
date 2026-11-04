import { createBrowserRouter, Navigate } from 'react-router';
import { Home, Private, Public } from './route-guards.js';
import { LegalScreen } from '../capabilities/about/LegalScreen.js';
import { OutboxScreen } from '../capabilities/devtools/OutboxScreen.js';
import { ForgotPasswordScreen } from '../capabilities/identity/ForgotPasswordScreen.js';
import { ResetPasswordScreen } from '../capabilities/identity/ResetPasswordScreen.js';
import { SignInScreen } from '../capabilities/identity/SignInScreen.js';
import { SignUpScreen } from '../capabilities/identity/SignUpScreen.js';
import { BankScreen } from '../capabilities/library/BankScreen.js';
import { QuestionScreen } from '../capabilities/review/QuestionScreen.js';
import { ReviewLink } from '../capabilities/review/ReviewLink.js';
import { ReviewScreen } from '../capabilities/review/ReviewScreen.js';
import { ImportReportScreen } from '../capabilities/sources/ImportReportScreen.js';
import { ImportScreen } from '../capabilities/sources/ImportScreen.js';
import { SourcesCard } from '../capabilities/sources/SourcesCard.js';
import { AppShell } from './AppShell.js';
import { SettingsPage } from './SettingsPage.js';
import { ProvidersScreen } from '../capabilities/providers/ProvidersScreen.js';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Home /> },
      {
        path: '/banks/:bankId',
        element: (
          <Private>
            <BankScreen
              sources={(bankId) => (
                <>
                  <ReviewLink bankId={bankId} />
                  <SourcesCard bankId={bankId} />
                </>
              )}
            />
          </Private>
        ),
      },
      {
        path: '/banks/:bankId/review',
        element: (
          <Private>
            <ReviewScreen />
          </Private>
        ),
      },
      {
        path: '/questions/:id',
        element: (
          <Private>
            <QuestionScreen />
          </Private>
        ),
      },
      {
        path: '/banks/:bankId/import',
        element: (
          <Private>
            <ImportScreen />
          </Private>
        ),
      },
      {
        path: '/imports/:id',
        element: (
          <Private>
            <ImportReportScreen />
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
        path: '/settings/providers',
        element: (
          <Private>
            <ProvidersScreen />
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
