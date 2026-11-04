import { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemResponse, SessionResponse } from '../../../contracts/study.js';
import { errorMessageKey } from '../../platform/api/messages.js';
import { fetchItem, fetchSession, savePosition, sendAnswer } from './api.js';

/**
 * A Tutor session in the browser: the current question, the chosen letters, and the time
 * spent on it. The place is saved on the server, so another device carries on (FR-12-008).
 */
export function useTutor(sessionId: string) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [item, setItem] = useState<ItemResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(Date.now());
  const show = useCallback(
    async (position: number) => {
      const next = await fetchItem(sessionId, position);
      setItem(next);
      setSelected(next.solution?.chosen ?? []);
      shownAt.current = Date.now();
    },
    [sessionId],
  );
  useEffect(() => {
    fetchSession(sessionId)
      .then(async (loaded) => {
        setSession(loaded);
        await show(loaded.position);
      })
      .catch((e: unknown) => setError(errorMessageKey(e)));
  }, [sessionId, show]);
  const go = async (position: number) => {
    setSession(await savePosition(sessionId, position));
    await show(position);
  };
  const submit = async () => {
    if (!item) return;
    const seconds = Math.round((Date.now() - shownAt.current) / 1000);
    setItem(await sendAnswer(sessionId, item.position, selected, seconds));
  };
  return { session, item, setItem, selected, setSelected, error, go, submit };
}
