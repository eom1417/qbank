import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';
import {
  AccountResponse,
  type SignInRequest,
  type SignUpRequest,
} from '../../../contracts/identity.js';
import { ApiError, apiRequest } from '../../platform/api/client.js';

type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; account: AccountResponse };

interface Session {
  state: SessionState;
  signIn(input: SignInRequest): Promise<void>;
  signUp(input: SignUpRequest): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

async function loadAccount(): Promise<SessionState> {
  try {
    return {
      status: 'signed-in',
      account: await apiRequest('GET', '/api/auth/me', AccountResponse),
    };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'unauthenticated')
      return { status: 'signed-out' };
    throw error;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  useEffect(() => {
    loadAccount().then(setState, () => setState({ status: 'signed-out' }));
  }, []);
  const signedIn = (account: AccountResponse) => setState({ status: 'signed-in', account });
  const session: Session = {
    state,
    signIn: async (input) =>
      signedIn(await apiRequest('POST', '/api/auth/sign-in', AccountResponse, input)),
    signUp: async (input) =>
      signedIn(await apiRequest('POST', '/api/auth/sign-up', AccountResponse, input)),
    signOut: async () => {
      await apiRequest('POST', '/api/auth/sign-out', z.null());
      setState({ status: 'signed-out' });
    },
  };
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
