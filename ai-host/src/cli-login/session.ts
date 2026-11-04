import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { LOGIN_METHODS, LOGOUT, type LoginMethodId, type LoginProvider } from './methods.ts';
import { lastLine, plainText, readPrompt } from './output.ts';

export type LoginStatus = 'starting' | 'waiting' | 'verifying' | 'done' | 'failed' | 'expired';

interface Session {
  readonly id: string;
  readonly owner: string;
  readonly method: LoginMethodId;
  status: LoginStatus;
  link: string | null;
  userCode: string | null;
  message: string | null;
  output: string;
  typed: string[];
  child: ChildProcess;
  timer: NodeJS.Timeout;
}

/** A device code lives 15 minutes; a sign-in left open longer is stopped. */
const LIFETIME_MS = 15 * 60 * 1000;
/** Lines wide enough that a long sign-in link is never wrapped. */
const COLUMNS = 4000;
const sessions = new Map<string, Session>();

/** A real terminal for CLIs that only prompt in one (`script` is in util-linux). */
function launch(method: LoginMethodId) {
  const { argv, input } = LOGIN_METHODS[method];
  const env = { ...process.env, COLUMNS: String(COLUMNS), TERM: 'dumb', NO_COLOR: '1' };
  if (input === 'secret') return spawn(argv[0], argv.slice(1), { env });
  const command = `stty cols ${COLUMNS} 2>/dev/null; exec ${argv.join(' ')}`;
  return spawn('script', ['-qfec', command, '/dev/null'], { env });
}

/** An ended sign-in stays readable this long (the screen shows how it ended), then goes. */
const KEPT_AFTER_END_MS = 5 * 60_000;

function settle(session: Session, status: LoginStatus, message: string | null) {
  if (!['starting', 'waiting', 'verifying'].includes(session.status)) return;
  session.status = status;
  session.message = message;
  clearTimeout(session.timer);
  if (session.child.exitCode === null) session.child.kill('SIGTERM');
  setTimeout(() => sessions.delete(session.id), KEPT_AFTER_END_MS).unref();
}

function watch(session: Session) {
  const read = (chunk: Buffer) => {
    session.output = plainText(session.output + chunk.toString('utf8')).slice(-20_000);
    const prompt = readPrompt(session.output);
    session.link ??= prompt.link;
    if (LOGIN_METHODS[session.method].input === 'none') session.userCode ??= prompt.code;
    if (session.status === 'starting' && session.link) session.status = 'waiting';
  };
  session.child.stdout?.on('data', read);
  session.child.stderr?.on('data', read);
  session.child.on('error', () => settle(session, 'failed', 'cli_unavailable'));
  session.child.on('exit', (code) =>
    settle(session, code === 0 ? 'done' : 'failed', lastLine(session.output, session.typed)),
  );
}

/** Starts one sign-in; a newer one for the same owner and provider replaces the older. */
export function startLogin(owner: string, method: LoginMethodId, secret?: string) {
  const provider = LOGIN_METHODS[method].provider;
  for (const old of sessions.values())
    if (old.owner === owner && LOGIN_METHODS[old.method].provider === provider)
      settle(old, 'failed', 'replaced');
  const child = launch(method);
  const session: Session = {
    id: randomUUID(),
    owner,
    method,
    status: 'starting',
    link: null,
    userCode: null,
    message: null,
    output: '',
    typed: secret ? [secret] : [],
    child,
    timer: setTimeout(() => settle(session, 'expired', null), LIFETIME_MS),
  };
  sessions.set(session.id, session);
  watch(session);
  if (secret !== undefined) {
    session.status = 'verifying';
    child.stdin?.end(`${secret}\n`);
  }
  return view(session);
}

const find = (owner: string, id: string) => {
  const session = sessions.get(id);
  return session && session.owner === owner ? session : null;
};

/** What the screen shows: never the CLI's raw output, never anything typed into it. */
export function view(session: Session) {
  const { id, method, status, link, userCode, message } = session;
  const needsCode = LOGIN_METHODS[method].input === 'code' && status === 'waiting';
  return {
    id,
    method,
    provider: LOGIN_METHODS[method].provider,
    status,
    link,
    userCode,
    needsCode,
    message,
  };
}

export const readLogin = (owner: string, id: string) => {
  const session = find(owner, id);
  return session ? view(session) : null;
};

/** The code the provider's page shows after approval, typed into the waiting CLI. */
export function submitCode(owner: string, id: string, code: string) {
  const session = find(owner, id);
  if (!session) return null;
  if (session.status !== 'waiting') return view(session);
  session.typed.push(code);
  session.status = 'verifying';
  session.child.stdin?.write(`${code}\r`);
  return view(session);
}

export function cancelLogin(owner: string, id: string) {
  const session = find(owner, id);
  if (!session) return null;
  settle(session, 'failed', 'cancelled');
  return view(session);
}

/** Signs the CLI out; its saved credentials are removed by the CLI itself. */
export function logout(provider: LoginProvider) {
  const [bin = '', ...args] = LOGOUT[provider];
  return new Promise<boolean>((done) => {
    const child = spawn(bin, args, { stdio: 'ignore' });
    child.on('error', () => done(false));
    child.on('exit', (code) => done(code === 0));
  });
}
