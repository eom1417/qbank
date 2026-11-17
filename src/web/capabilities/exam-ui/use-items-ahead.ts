import { useEffect, useMemo } from 'react';
import { itemsAhead, type AheadSpan } from './items-ahead.js';

/**
 * The questions around the shown one, fetched ahead (M34 U3) and kept as the shown one changes.
 * `peek` and `warm` must be stable (useCallback).
 */
export function useItemsAhead<T extends { position: number; total: number }>(
  item: T | null,
  peek: (position: number) => Promise<T>,
  warm: (item: T) => void,
  span: AheadSpan,
) {
  const { previous } = span;
  const ahead = useMemo(() => itemsAhead(peek, warm, { previous }), [peek, warm, previous]);
  useEffect(() => {
    if (item) ahead.around(item);
  }, [ahead, item]);
  return ahead;
}
