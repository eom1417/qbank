import type {
  TakeAllowed,
  TakeItemResponse,
  TakeLandingResponse,
  TakeResultResponse,
  TakeStateResponse,
} from '../../../contracts/take.js';
import type { ErrorCode } from '../../../contracts/errors.js';
import { ApiError } from '../../platform/api/client.js';
import type { AttemptApi, StartInput } from './api.js';
import type { AttemptStore } from './attempt-store.js';

/**
 * The rules of taking a shared exam in the browser, apart from React so they can be tested:
 * resuming a kept attempt, saving honestly, and moving only as the share allows.
 */

/** Where the person is: the rules before starting, inside an attempt, or at its result. */
export type Entry =
  | { phase: 'landing'; landing: TakeLandingResponse }
  | { phase: 'attempt'; token: string; state: TakeStateResponse }
  | { phase: 'result'; token: string; result: TakeResultResponse };

export interface EntryDeps {
  landing(link: string): Promise<TakeLandingResponse>;
  attempt(token: string): Pick<AttemptApi, 'state' | 'result'>;
}

const codeOf = (error: unknown): ErrorCode | 'network' =>
  error instanceof ApiError ? error.code : 'internal';

/** A kept token the server no longer knows: the attempt is gone, start from the rules. */
const STALE: readonly string[] = ['unauthenticated', 'invalid_token', 'not_found'];

/** An attempt as the server has it now: still going, or already submitted. */
export async function resume(
  token: string,
  api: Pick<AttemptApi, 'state' | 'result'>,
): Promise<Entry> {
  const state = await api.state();
  if (state.status === 'submitted') return { phase: 'result', token, result: await api.result() };
  return { phase: 'attempt', token, state };
}

/**
 * Opening the link: the attempt kept in this browser if the server still has it, otherwise
 * the rules. A lost connection is an error to retry, never a reason to forget the attempt.
 */
export async function enter(link: string, store: AttemptStore, deps: EntryDeps): Promise<Entry> {
  const token = store.read(link);
  if (token) {
    try {
      return await resume(token, deps.attempt(token));
    } catch (error) {
      if (!STALE.includes(codeOf(error))) throw error;
      store.forget(link);
    }
  }
  return { phase: 'landing', landing: await deps.landing(link) };
}

/** Starting: the new attempt's token is kept before anything else, so a reload resumes it. */
export async function begin(
  link: string,
  input: StartInput,
  store: AttemptStore,
  start: (link: string, input: StartInput) => Promise<{ token: string }>,
): Promise<string> {
  const { token } = await start(link, input);
  store.keep(link, token);
  return token;
}

export type SaveOutcome =
  | { status: 'saved'; item: TakeItemResponse }
  | { status: 'failed'; item: TakeItemResponse; code: ErrorCode | 'network' };

/**
 * Saving a choice. On failure the question shows again what the server last confirmed, so the
 * screen never shows an answer as chosen when it was not saved.
 */
export async function saveChoice(
  api: Pick<AttemptApi, 'choose'>,
  item: TakeItemResponse,
  chosen: string[],
): Promise<SaveOutcome> {
  try {
    return { status: 'saved', item: await api.choose(item.position, chosen) };
  } catch (error) {
    return { status: 'failed', item, code: codeOf(error) };
  }
}

/** Free movement, or forward only: then no way back, and the map only goes ahead. */
export function navigationOf(allowed: TakeAllowed, position: number, total: number) {
  const forward = allowed.navigation === 'forward';
  return {
    canPrevious: !forward && position > 0,
    canNext: position < total - 1,
    canGo: (target: number) => !forward || target >= position,
  };
}
