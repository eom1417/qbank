import { createBrowserRouter, Navigate } from 'react-router';
import { Home, Private, Public } from './route-guards.js';
import { LegalScreen } from '../capabilities/about/LegalScreen.js';
import { OutboxScreen } from '../capabilities/devtools/OutboxScreen.js';
import { ForgotPasswordScreen } from '../capabilities/identity/ForgotPasswordScreen.js';
import { ResetPasswordScreen } from '../capabilities/identity/ResetPasswordScreen.js';
import { SignInScreen } from '../capabilities/identity/SignInScreen.js';
import { SignUpScreen } from '../capabilities/identity/SignUpScreen.js';
import { BankScreen } from '../capabilities/library/BankScreen.js';
import { DuplicatesLink } from '../capabilities/duplicates/DuplicatesLink.js';
import { DuplicatesScreen } from '../capabilities/duplicates/DuplicatesScreen.js';
import { ReimportCard } from '../capabilities/duplicates/ReimportCard.js';
import { TransferCard } from '../capabilities/duplicates/TransferCard.js';
import { QuestionScreen } from '../capabilities/review/QuestionScreen.js';
import { ExamCheckScreen } from '../capabilities/study/ExamCheckScreen.js';
import { ExamScreen } from '../capabilities/study/ExamScreen.js';
import { PlanScreen } from '../capabilities/study/PlanScreen.js';
import { StudyLink } from '../capabilities/study/StudyLink.js';
import { StudySetupScreen } from '../capabilities/study/StudySetupScreen.js';
import { SummaryScreen } from '../capabilities/study/SummaryScreen.js';
import { TutorScreen } from '../capabilities/study/TutorScreen.js';
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
                  <StudyLink bankId={bankId} />
                  <ReviewLink bankId={bankId} />
                  <DuplicatesLink bankId={bankId} />
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
        path: '/study',
        element: (
          <Private>
            <StudySetupScreen />
          </Private>
        ),
      },
      {
        path: '/study/plan',
        element: (
          <Private>
            <PlanScreen />
          </Private>
        ),
      },
      {
        path: '/study/sessions/:id',
        element: (
          <Private>
            <TutorScreen />
          </Private>
        ),
      },
      {
        path: '/exam/sessions/:id',
        element: (
          <Private>
            <ExamScreen />
          </Private>
        ),
      },
      {
        path: '/exam/sessions/:id/check',
        element: (
          <Private>
            <ExamCheckScreen />
          </Private>
        ),
      },
      {
        path: '/study/sessions/:id/summary',
        element: (
          <Private>
            <SummaryScreen />
          </Private>
        ),
      },
      {
        path: '/banks/:bankId/duplicates',
        element: (
          <Private>
            <DuplicatesScreen />
          </Private>
        ),
      },
      {
        path: '/questions/:id',
        element: (
          <Private>
            <QuestionScreen
              extras={(question, onChange) => (
                <>
                  <ReimportCard question={question} onChosen={onChange} />
                  <TransferCard question={question} />
                </>
              )}
            />
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
