import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSession } from './session.js';

/**
 * Password screens (forgot, reset) do not exist on a Google-only server (DEC-42): they go to
 * sign-in. Nothing is shown until the server has said how people sign in.
 */
export function PasswordOnly({ children }: { children: ReactNode }) {
  const { state, signInMethod } = useSession();
  if (signInMethod === 'google') return <Navigate to="/sign-in" replace />;
  if (state.status === 'loading') return null;
  return children;
}
