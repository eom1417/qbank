import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';
import {
  AccountResponse,
  AppMetaResponse,
  type AppMode,
  type SignInRequest,
  type SignUpRequest,
  type UpdateAccountRequest,
} from '../../../contracts/identity.js';
import { useTheme } from '../../design-system/index.js';
import { ApiError, apiRequest } from '../../platform/api/client.js';
import { useI18n } from '../../platform/i18n/i18n.js';

type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; account: AccountResponse };

interface Session {
  state: SessionState;
  /** Local install (DEC-31) or accounts; null until the server says. */
  mode: AppMode | null;
  /** Local mode: pairs this browser with the install's pairing code. */
  pair(token: string): Promise<void>;
  signIn(input: SignInRequest): Promise<void>;
  signUp(input: SignUpRequest): Promise<void>;
  signOut(): Promise<void>;
  /** Saves profile/preferences on the server and applies the returned account. */
  updateAccount(changes: UpdateAccountRequest): Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

/**
 * A pairing link carries its code after `#pair=`. It is read once per page load (not in an
 * effect, which may run twice) and removed from the address.
 */
function takePairingCode(): string | undefined {
  const match = /^#pair=([\w-]+)$/.exec(window.location.hash);
  if (!match) return undefined;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return match[1];
}
const pairingCodeOnLoad = takePairingCode();

const pairWith = (token?: string) =>
  apiRequest('POST', '/api/local/pair', AccountResponse, token ? { token } : {});

/** Local mode: an unpaired browser pairs itself (this computer, or a pairing link). */
async function loadLocal(): Promise<SessionState> {
  const signedIn = await loadAccount();
  if (signedIn.status === 'signed-in') return signedIn;
  try {
    return { status: 'signed-in', account: await pairWith(pairingCodeOnLoad) };
  } catch {
    return { status: 'signed-out' };
  }
}

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

/** The account's saved language, theme and skin win over this browser's local choice. */
function useApplySavedPreferences(state: SessionState) {
  const { setLocale } = useI18n();
  const { setTheme, setSkin } = useTheme();
  const preferences = state.status === 'signed-in' ? state.account.preferences : null;
  useEffect(() => {
    if (!preferences) return;
    setLocale(preferences.locale);
    setTheme(preferences.theme);
    setSkin(preferences.skin);
  }, [preferences, setLocale, setTheme, setSkin]);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [mode, setMode] = useState<AppMode | null>(null);
  useApplySavedPreferences(state);
  useEffect(() => {
    apiRequest('GET', '/api/meta', AppMetaResponse)
      .then(({ mode: current }) => {
        setMode(current);
        return current === 'local' ? loadLocal() : loadAccount();
      })
      .then(setState, () => setState({ status: 'signed-out' }));
  }, []);
  const signedIn = (account: AccountResponse) => setState({ status: 'signed-in', account });
  const post = (path: string, body: unknown) => apiRequest('POST', path, AccountResponse, body);
  const session: Session = {
    state,
    mode,
    pair: async (token) => signedIn(await pairWith(token)),
    signIn: async (input) => signedIn(await post('/api/auth/sign-in', input)),
    signUp: async (input) => signedIn(await post('/api/auth/sign-up', input)),
    signOut: async () => {
      await apiRequest('POST', '/api/auth/sign-out', z.null());
      setState({ status: 'signed-out' });
    },
    updateAccount: async (changes) =>
      signedIn(await apiRequest('PATCH', '/api/account', AccountResponse, changes)),
  };
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
