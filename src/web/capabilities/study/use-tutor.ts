import { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemResponse, SessionResponse } from '../../../contracts/study.js';
import { errorMessageKey } from '../../platform/api/messages.js';
import { fetchItem, fetchSession, savePosition, sendAnswer } from './api.js';
import { useStudyAhead } from './use-study-ahead.js';

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
  const wanted = useRef<number | null>(null);
  const ahead = useStudyAhead(sessionId, item);
  const present = useCallback((next: ItemResponse) => {
    setItem(next);
    setSelected(next.solution?.chosen ?? []);
    shownAt.current = Date.now();
  }, []);
  // A question fetched ahead shows at once; the server's answer then confirms it (M34 U3).
  const show = useCallback(
    async (position: number) => {
      wanted.current = position;
      const early = ahead.ready(position);
      if (early) present(early);
      const next = await fetchItem(sessionId, position);
      if (wanted.current !== position) return;
      if (early) setItem(next);
      else present(next);
    },
    [sessionId, ahead, present],
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
    const [saved] = await Promise.all([savePosition(sessionId, position), show(position)]);
    setSession(saved);
  };
  const submit = async () => {
    if (!item) return;
    const seconds = Math.round((Date.now() - shownAt.current) / 1000);
    setItem(await sendAnswer(sessionId, item.position, selected, seconds));
  };
  return { session, item, setItem, selected, setSelected, error, go, submit };
}
