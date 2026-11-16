import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ExamStateResponse, ItemResponse } from '../../../contracts/study.js';
import { ApiError } from '../../platform/api/client.js';
import type { SaveStatus } from '../exam-ui/SaveState.js';
import { fetchExamState, flagExamItem, openExamItem, saveChoice } from './api.js';
import { useStudyAhead } from './use-study-ahead.js';

/** The exam's map and clock as the server last said; a finished exam goes to its result. */
function useExamState(sessionId: string) {
  const navigate = useNavigate();
  const [state, setState] = useState<ExamStateResponse | null>(null);
  const toResult = useCallback(
    () => void navigate(`/study/sessions/${sessionId}/summary`),
    [navigate, sessionId],
  );
  const refresh = useCallback(async () => {
    const next = await fetchExamState(sessionId);
    setState(next);
    if (next.status === 'finished') toResult();
    return next;
  }, [sessionId, toResult]);
  return { state, setState, refresh, toResult };
}

/**
 * An exam in the browser (UI-17): the server keeps the answers, the flags and the clock; the
 * screen says honestly whether the last choice was saved (FR-13-007, FR-23-006).
 */
export function useExam(sessionId: string, startAt: number | null) {
  const { state, setState, refresh, toResult } = useExamState(sessionId);
  const [item, setItem] = useState<ItemResponse | null>(null);
  const [saving, setSaving] = useState<SaveStatus>('idle');
  const ahead = useStudyAhead(sessionId, item);
  const wanted = useRef<number | null>(null);
  // A question fetched ahead shows at once; opening it on the server then confirms it (M34 U3).
  const go = useCallback(
    async (position: number) => {
      wanted.current = position;
      const early = ahead.ready(position);
      if (early) setItem(early);
      setSaving('idle');
      const opened = await openExamItem(sessionId, position);
      if (wanted.current !== position) return;
      setItem(opened);
      await refresh();
    },
    [sessionId, ahead, refresh],
  );
  useEffect(() => {
    refresh()
      .then(async (first) => {
        if (first.status === 'active') await go(startAt ?? first.position);
      })
      .catch(() => setState(null));
  }, [refresh, go, startAt]);
  const choose = async (chosen: string[]) => {
    if (!item) return;
    setItem({ ...item, saved: chosen });
    setSaving('saving');
    try {
      setItem(await saveChoice(sessionId, item.position, chosen));
      setSaving('saved');
      await refresh();
    } catch (error) {
      setSaving('failed');
      if (error instanceof ApiError && error.code === 'exam_ended') toResult();
    }
  };
  const toggleFlag = async () => {
    if (item) setItem(await flagExamItem(sessionId, item.position, !item.examFlag));
    await refresh();
  };
  return { state, item, saving, go, choose, toggleFlag, refresh };
}
