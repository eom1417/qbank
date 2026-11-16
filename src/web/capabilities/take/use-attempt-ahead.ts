import { useCallback, useEffect, useMemo } from 'react';
import type { TakeItemResponse } from '../../../contracts/take.js';
import { cardPictureIds } from '../exam-ui/card-pictures.js';
import { useItemsAhead } from '../exam-ui/use-items-ahead.js';
import type { AttemptApi } from './api.js';
import { pictureCache } from './picture-cache.js';

/** The server reads ahead only the question after the current one. */
const NEXT_ONLY = { previous: false };

/**
 * The next question of the attempt and its pictures, fetched while the current one is shown
 * (M34 U3). Only the shown question's pictures and the next one's are kept.
 */
export function useAttemptAhead(api: AttemptApi, item: TakeItemResponse | null) {
  const pictures = useMemo(() => pictureCache((id) => api.picture(id)), [api]);
  useEffect(() => () => pictures.release(), [pictures]);
  const peek = useCallback((position: number) => api.peek(position), [api]);
  const warm = useCallback(
    (next: TakeItemResponse) => cardPictureIds(next).forEach((id) => void pictures.load(id)),
    [pictures],
  );
  const ahead = useItemsAhead(item, peek, warm, NEXT_ONLY);
  useEffect(() => {
    if (!item) return;
    const next = ahead.ready(item.position + 1);
    pictures.keep([...cardPictureIds(item), ...(next ? cardPictureIds(next) : [])]);
  }, [ahead, item, pictures]);
  return { ahead, pictures };
}
