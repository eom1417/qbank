import type { IncomingMessage } from 'node:http';
import { readJson } from '../http/guard.ts';
import { isMethod, isProvider } from './methods.ts';
import { cancelLogin, logout, readLogin, startLogin, submitCode } from './session.ts';

type Reply = { readonly status: number; readonly body: unknown };

const MAX_INPUT = 512;
/** A pasted code or key: printable, one line, bounded. */
const isLine = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_INPUT &&
  /^[\x21-\x7e]+$/.test(value);

const invalid: Reply = { status: 400, body: { error: { _tag: 'InvalidInput' } } };
const missing: Reply = { status: 404, body: { error: { _tag: 'NotFound' } } };
const found = (session: unknown): Reply => (session ? { status: 200, body: session } : missing);

function start(owner: string, input: Record<string, unknown>): Reply {
  if (!isMethod(input['method'])) return invalid;
  const secret = input['secret'];
  if (input['method'] === 'codex.apiKey' ? !isLine(secret) : secret !== undefined) return invalid;
  return { status: 200, body: startLogin(owner, input['method'], secret as string | undefined) };
}

/** `POST /login/start|logout` and `POST /login/<id>/code|cancel`. */
async function post(
  owner: string,
  [first = '', action]: readonly string[],
  input: Record<string, unknown>,
) {
  if (first === 'start' && action === undefined) return start(owner, input);
  if (first === 'logout' && action === undefined)
    return isProvider(input['provider'])
      ? { status: 200, body: { signedOut: await logout(input['provider']) } }
      : invalid;
  if (action === 'code')
    return isLine(input['code']) ? found(submitCode(owner, first, input['code'])) : invalid;
  if (action === 'cancel') return found(cancelLogin(owner, first));
  return missing;
}

/**
 * Sign-in through the providers' CLIs: start, read (`GET /login/<id>`), paste a code, cancel,
 * sign out. Each sign-in belongs to the owner session that started it, like the kit's own flows.
 */
export async function loginRoute(
  request: IncomingMessage,
  path: string,
  owner: string,
): Promise<Reply | null> {
  if (!path.startsWith('/login/')) return null;
  const parts = path.slice('/login/'.length).split('/');
  if (request.method === 'GET')
    return parts.length === 1 ? found(readLogin(owner, parts[0] ?? '')) : missing;
  if (request.method !== 'POST' || parts.length > 2) return missing;
  const input = await readJson(request);
  if (input === null || typeof input !== 'object') return invalid;
  return post(owner, parts, input as Record<string, unknown>);
}
