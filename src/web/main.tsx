import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { DEFAULT_SKIN } from '../contracts/identity.js';
import { router } from './app/routes.js';
import { SessionProvider } from './capabilities/identity/session.js';
import { ThemeProvider } from './design-system/index.js';
import { I18nProvider } from './platform/i18n/i18n.js';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider defaultSkin={DEFAULT_SKIN}>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);

// Installable on a phone (PWA). Only for the built app on a secure address: in development a
// worker would keep stale files, and browsers refuse workers on plain http (except localhost).
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext)
  void navigator.serviceWorker.register('/sw.js');
