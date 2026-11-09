import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TakeResultResponse } from '../../../contracts/take.js';
import { errorMessageKey } from '../../platform/api/messages.js';
import type { MessageKey } from '../../platform/i18n/i18n.js';
import { attemptApi, fetchLanding, startAttempt, type StartInput } from './api.js';
import { attemptStore } from './attempt-store.js';
import { begin, enter, resume, type Entry } from './take-flow.js';

const DEPS = { landing: fetchLanding, attempt: attemptApi };

/**
 * The page behind a shared link: resumes the attempt this browser kept, or shows the rules;
 * then the attempt, then its result. The server decides every step.
 */
export function useTake(link: string) {
  const store = useMemo(() => attemptStore(localStorage), []);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const load = useCallback(() => {
    setError(null);
    setEntry(null);
    enter(link, store, DEPS).then(setEntry, (e: unknown) => setError(errorMessageKey(e)));
  }, [link, store]);
  useEffect(load, [load]);
  const start = useCallback(
    async (input: StartInput) => {
      const token = await begin(link, input, store, startAttempt);
      setEntry(await resume(token, attemptApi(token)));
    },
    [link, store],
  );
  const showResult = useCallback(
    (token: string, result: TakeResultResponse) => setEntry({ phase: 'result', token, result }),
    [],
  );
  return { entry, error, retry: load, start, showResult };
}
