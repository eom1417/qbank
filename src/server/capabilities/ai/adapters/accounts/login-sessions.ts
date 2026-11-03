import type { ChildProcess } from 'node:child_process';
import type { AccountLoginStatus, AccountProvider } from '../../../../../contracts/ai.js';
import {
  closeAccountHome,
  openAccountHome,
  type AccountHome,
  type HomeSettings,
} from './account-home.js';
import type { AccountOps, Identity } from './account-ops.js';
import { startCli, stopCli } from './cli-process.js';

export interface LoginSnapshot {
  id: string;
  provider: AccountProvider;
  status: AccountLoginStatus;
  authUrl: string | null;
  deviceCode: string | null;
  /** A stable reason: `login_unavailable` (CLI missing or silent) or `login_failed`. */
  error: string | null;
  providerId: string | null;
}

export interface CompletedLogin {
  ownerId: string;
  provider: AccountProvider;
  credential: string;
  identity: Identity;
}

interface Session extends LoginSnapshot {
  ownerId: string;
  ops: AccountOps;
  home: AccountHome;
  child: ChildProcess;
  output: string;
  timer: NodeJS.Timeout;
  ready: () => void;
}

interface LoginSettings {
  home: HomeSettings;
  opsFor(provider: AccountProvider): AccountOps;
  /** Seals the credential and saves the connection; returns its id. */
  onComplete(login: CompletedLogin): Promise<string>;
  newId(): string;
  /** How long a started sign-in may wait for the user (the CLIs' codes last 15 minutes). */
  ttlMs?: number;
  /** How long the CLI may take to print its sign-in link. */
  urlWaitMs?: number;
}

const FINISHED: ReadonlySet<AccountLoginStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
  'expired',
]);
const MAX_OUTPUT = 64 * 1024;
const LATE_WRITE_MS = 3000;
/** Terminal control characters become spaces, so links and codes can be read as plain text. */
const printable = (text: string) =>
  [...text]
    .map((char) => (char.charCodeAt(0) < 32 && char !== '\n' ? ' ' : char))
    .join('')
    // What is left of colour codes once their escape character is gone ("[94m").
    .replace(/ \[[0-9;?]*[A-Za-z]/g, ' ');

const snapshot = (session: Session): LoginSnapshot => ({
  id: session.id,
  provider: session.provider,
  status: session.status,
  authUrl: session.authUrl,
  deviceCode: session.deviceCode,
  error: session.error,
  providerId: session.providerId,
});

/** True once the user has everything needed: the link, and Codex's one-time code. */
const isShown = (session: Session) =>
  session.authUrl !== null && (!session.ops.login.codePattern || session.deviceCode !== null);

const firstMatch = (pattern: RegExp | null, text: string): string | null =>
  pattern?.exec(text)?.[0] ?? null;

/** Reads the sign-in link (and Codex's one-time code) from what the CLI printed so far. */
function parseOutput(session: Session) {
  const { login } = session.ops;
  const text = printable(session.output);
  session.authUrl ??= firstMatch(login.urlPattern, text);
  session.deviceCode ??= firstMatch(login.codePattern, text);
  if (!isShown(session)) return;
  if (login.needsCode && session.status === 'waiting') session.status = 'awaiting_code';
  session.ready();
}

function end(session: Session, status: AccountLoginStatus, error: string | null = null) {
  if (FINISHED.has(session.status)) return;
  session.status = status;
  session.error = error;
  clearTimeout(session.timer);
  session.ready();
}

function cancelSession(session: Session) {
  end(session, 'cancelled');
  stopCli(session.child);
}

/** After the CLI exits: keep its login (re-read after the identity check, which may refresh). */
async function finish(settings: LoginSettings, session: Session, exitCode: number | null) {
  try {
    const credential = exitCode === 0 ? await session.ops.spec.read(session.home.home) : null;
    const identity = credential ? await session.ops.identify(session.home) : null;
    const current = (await session.ops.spec.read(session.home.home)) ?? credential;
    if (!current || !identity || FINISHED.has(session.status)) {
      end(session, 'failed', 'login_failed');
      return;
    }
    const { ownerId, provider } = session;
    session.providerId = await settings.onComplete({
      ownerId,
      provider,
      credential: current,
      identity,
    });
    end(session, 'completed');
  } catch {
    end(session, 'failed', 'login_failed');
  } finally {
    await closeAccountHome(session.home);
    // Claude runs under `script` in its own terminal session and may write its settings once
    // more as that terminal closes; remove the home again after it is surely gone.
    setTimeout(() => void closeAccountHome(session.home), LATE_WRITE_MS).unref();
  }
}

function watch(settings: LoginSettings, session: Session) {
  const collect = (chunk: Buffer) => {
    session.output = (session.output + chunk.toString('utf8')).slice(-MAX_OUTPUT);
    parseOutput(session);
  };
  session.child.stdout?.on('data', collect);
  session.child.stderr?.on('data', collect);
  session.child.on('error', () => end(session, 'failed', 'login_unavailable'));
  session.child.on('close', (code) => void finish(settings, session, code));
}

/** Starts the CLI's sign-in in a private home and waits until it shows the link. */
async function openSession(settings: LoginSettings, ownerId: string, provider: AccountProvider) {
  const ops = settings.opsFor(provider);
  const home = await openAccountHome(settings.home, ops.spec);
  let ready = () => {};
  const shown = new Promise<void>((resolve) => (ready = resolve));
  const child = startCli(ops.login.command(home));
  const blank = {
    status: 'waiting',
    authUrl: null,
    deviceCode: null,
    error: null,
    providerId: null,
  } as const;
  const session: Session = {
    ...blank,
    ...{ id: settings.newId(), provider, ownerId, ops, home, child, output: '', ready },
    timer: setTimeout(
      () => {
        stopCli(child);
        end(session, 'expired');
      },
      settings.ttlMs ?? 15 * 60_000,
    ),
  };
  watch(settings, session);
  const wait = new Promise((resolve) => setTimeout(resolve, settings.urlWaitMs ?? 20_000));
  await Promise.race([shown, wait]);
  if (!session.authUrl && !FINISHED.has(session.status)) {
    cancelSession(session);
    session.status = 'failed';
    session.error = 'login_unavailable';
  }
  return session;
}

/**
 * Sign-in with a subscription account through the provider's official CLI, in a private home
 * (the Remote pattern): the user approves in their own browser; the app never sees a password.
 */
export function createLoginManager(settings: LoginSettings) {
  const sessions = new Map<string, Session>();
  const owned = (ownerId: string, id: string) => {
    const session = sessions.get(id);
    return session && session.ownerId === ownerId ? session : undefined;
  };
  return {
    /** Starts a sign-in; an earlier one of the same owner and provider is cancelled. */
    async start(ownerId: string, provider: AccountProvider): Promise<LoginSnapshot> {
      for (const other of sessions.values()) {
        if (other.ownerId === ownerId && other.provider === provider) cancelSession(other);
      }
      const session = await openSession(settings, ownerId, provider);
      sessions.set(session.id, session);
      return snapshot(session);
    },
    get: (ownerId: string, id: string) => {
      const session = owned(ownerId, id);
      return session && snapshot(session);
    },
    /** Passes the code Claude showed after approval to the waiting CLI. */
    submitCode(ownerId: string, id: string, code: string): LoginSnapshot | undefined {
      const session = owned(ownerId, id);
      if (session?.status !== 'awaiting_code') return session && snapshot(session);
      session.child.stdin?.write(`${code}\r`);
      session.status = 'waiting';
      return snapshot(session);
    },
    cancel(ownerId: string, id: string): boolean {
      const session = owned(ownerId, id);
      if (session) cancelSession(session);
      return session !== undefined;
    },
  };
}

export type LoginManager = ReturnType<typeof createLoginManager>;
