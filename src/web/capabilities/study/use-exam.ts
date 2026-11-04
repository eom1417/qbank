import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ExamStateResponse, ItemResponse } from '../../../contracts/study.js';
import { ApiError } from '../../platform/api/client.js';
import { fetchExamState, flagExamItem, openExamItem, saveChoice } from './api.js';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * An exam in the browser (UI-17): the server keeps the answers, the flags and the clock; the
 * screen says honestly whether the last choice was saved (FR-13-007, FR-23-006).
 */
export function useExam(sessionId: string, startAt: number | null) {
  const navigate = useNavigate();
  const [state, setState] = useState<ExamStateResponse | null>(null);
  const [item, setItem] = useState<ItemResponse | null>(null);
  const [saving, setSaving] = useState<SaveStatus>('idle');
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
  const go = useCallback(
    async (position: number) => {
      setItem(await openExamItem(sessionId, position));
      setSaving('idle');
      await refresh();
    },
    [sessionId, refresh],
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
