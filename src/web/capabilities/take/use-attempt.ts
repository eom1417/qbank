import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  TakeItemResponse,
  TakeResultResponse,
  TakeStateResponse,
} from '../../../contracts/take.js';
import { errorMessageKey } from '../../platform/api/messages.js';
import type { MessageKey } from '../../platform/i18n/i18n.js';
import type { SaveStatus } from '../exam-ui/SaveState.js';
import { attemptApi, type AttemptApi } from './api.js';
import { saveChoice } from './take-flow.js';

/** How long to wait before asking again when the time is up but the server still runs it. */
const TIME_UP_RECHECK_MS = 2000;

type Guard = (work: Promise<unknown>) => void;

/** A failed call becomes a message on the page instead of an unhandled rejection. */
function useGuard() {
  const [error, setError] = useState<MessageKey | null>(null);
  const guard: Guard = useCallback(
    (work) => void work.catch((e: unknown) => setError(errorMessageKey(e))),
    [],
  );
  return { error, setError, guard };
}

/** Where the attempt stands, as the server says; at the end, its result. */
function useServerState(
  api: AttemptApi,
  first: TakeStateResponse,
  onResult: (result: TakeResultResponse) => void,
  guard: Guard,
) {
  const [state, setState] = useState(first);
  const finish = useCallback(async () => onResult(await api.result()), [api, onResult]);
  const refresh = useCallback(async () => {
    const next = await api.state();
    setState(next);
    if (next.status === 'submitted') await finish();
    return next;
  }, [api, finish]);
  // At zero only the server decides that the time is over; ask once more if it is not yet.
  const timeUp = useCallback(() => {
    const recheck = () => setTimeout(() => guard(refresh()), TIME_UP_RECHECK_MS);
    guard(refresh().then((next) => next.status === 'active' && recheck()));
  }, [guard, refresh]);
  return { state, finish, refresh, timeUp };
}

/** The open question: moving, choosing (saved honestly) and flagging. */
function useItem(api: AttemptApi, server: ReturnType<typeof useServerState>, guard: Guard) {
  const { refresh, finish } = server;
  const [item, setItem] = useState<TakeItemResponse | null>(null);
  const [saving, setSaving] = useState<SaveStatus>('idle');
  const go = useCallback(
    async (position: number) => {
      setItem(await api.open(position));
      setSaving('idle');
      await refresh();
    },
    [api, refresh],
  );
  const choose = async (chosen: string[]) => {
    if (!item) return;
    setItem({ ...item, saved: chosen });
    setSaving('saving');
    const outcome = await saveChoice(api, item, chosen);
    setItem(outcome.item);
    setSaving(outcome.status);
    if (outcome.status === 'saved') guard(refresh());
    else if (outcome.code === 'exam_ended') guard(finish());
  };
  const toggleFlag = () => {
    if (item) guard(api.flag(item.position, !item.flagged).then(setItem).then(refresh));
  };
  return { item, saving, go, choose, toggleFlag };
}

/**
 * One attempt in the browser: the server keeps the answers, the flags and the clock; the page
 * says honestly whether the last choice was saved, and moves to the result when it is over.
 * `onResult` must be stable (useCallback).
 */
export function useAttempt(
  token: string,
  first: TakeStateResponse,
  onResult: (result: TakeResultResponse) => void,
) {
  const api = useMemo(() => attemptApi(token), [token]);
  const { error, setError, guard } = useGuard();
  const server = useServerState(api, first, onResult, guard);
  const { go, ...current } = useItem(api, server, guard);
  useEffect(() => guard(go(first.position)), [guard, go, first.position]);
  const goTo = (position: number) => {
    setError(null);
    guard(go(position));
  };
  const submit = async () => onResult(await api.submit());
  return { api, ...server, ...current, error, go: goTo, submit };
}
