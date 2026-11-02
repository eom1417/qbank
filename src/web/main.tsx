import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/routes.js';
import { SessionProvider } from './capabilities/identity/session.js';
import { ThemeProvider } from './design-system/index.js';
import { I18nProvider } from './platform/i18n/i18n.js';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
