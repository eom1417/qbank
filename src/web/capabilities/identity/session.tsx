import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';
import {
  AccountResponse,
  AppMetaResponse,
  type AppMode,
  type SignInMethod,
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
  /** The server did not answer: never shown as signed out, which would offer a wrong sign-in. */
  | { status: 'unreachable' }
  | { status: 'signed-in'; account: AccountResponse };

interface Session {
  state: SessionState;
  /** Local install (DEC-31) or accounts; null until the server says. */
  mode: AppMode | null;
  /** Who runs this server (DEC-40), from /api/meta; null on a local install or until known. */
  operatorName: string | null;
  /**
   * How people sign in here (DEC-42): pairing (local), password, or Google only. Named apart from
   * `signIn()` below; null until the server says.
   */
  signInMethod: SignInMethod | null;
  /** The signed-in account is this server's declared operator (the server still enforces it). */
  isOperator: boolean;
  /** Asks the server again after it did not answer (also done by itself every few seconds). */
  retry(): void;
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

/** How often an unanswered start is retried by itself, so a restarted server is picked up. */
const RETRY_MS = 5000;

async function loadSession() {
  const meta = await apiRequest('GET', '/api/meta', AppMetaResponse);
  return { meta, state: await (meta.mode === 'local' ? loadLocal() : loadAccount()) };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [meta, setMeta] = useState<AppMetaResponse | null>(null);
  useApplySavedPreferences(state);
  const retry = useCallback(() => {
    loadSession().then(
      (loaded) => {
        setMeta(loaded.meta);
        setState(loaded.state);
      },
      () => setState({ status: 'unreachable' }),
    );
  }, []);
  useEffect(retry, [retry]);
  useEffect(() => {
    if (state.status !== 'unreachable') return;
    const timer = setInterval(retry, RETRY_MS);
    return () => clearInterval(timer);
  }, [state.status, retry]);
  const signedIn = (account: AccountResponse) => setState({ status: 'signed-in', account });
  const post = (path: string, body: unknown) => apiRequest('POST', path, AccountResponse, body);
  const session: Session = {
    state,
    mode: meta?.mode ?? null,
    operatorName: meta?.operatorName ?? null,
    signInMethod: meta?.signIn ?? null,
    isOperator: state.status === 'signed-in' && state.account.isOperator,
    retry,
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
