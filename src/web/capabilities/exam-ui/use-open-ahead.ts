import { useCallback, useRef } from 'react';
import type { SaveStatus } from './SaveState.js';

interface OpenAhead<T> {
  /** Opens the item on the server (the saved choice and its feedback). */
  open(position: number): Promise<T>;
  /** The items read ahead: one is shown at once when it is ready. */
  ahead: { ready(position: number): T | null };
  show(item: T): void;
  setSaving(status: SaveStatus): void;
  refresh(): Promise<unknown>;
}

/**
 * Going to a question: one read ahead shows at once; opening it on the server then confirms it
 * (M34 U3), unless the reader moved on meanwhile.
 */
export function useOpenAhead<T>({ open, ahead, show, setSaving, refresh }: OpenAhead<T>) {
  const wanted = useRef<number | null>(null);
  return useCallback(
    async (position: number) => {
      wanted.current = position;
      const early = ahead.ready(position);
      if (early) show(early);
      setSaving('idle');
      const opened = await open(position);
      if (wanted.current !== position) return;
      show(opened);
      await refresh();
    },
    [open, ahead, show, setSaving, refresh],
  );
}
