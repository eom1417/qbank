import { useCallback } from 'react';
import type { ItemResponse } from '../../../contracts/study.js';
import { cardPictureIds } from '../exam-ui/card-pictures.js';
import { useItemsAhead } from '../exam-ui/use-items-ahead.js';
import { fetchItem, mediaUrl } from './api.js';

const AROUND = { previous: true };

/** The browser fetches the pictures now; shown later, they come from its cache. */
function warmPictures(item: ItemResponse) {
  for (const id of cardPictureIds(item)) new Image().src = mediaUrl(id);
}

/**
 * The questions before and after the shown one, with their pictures, fetched while it is shown
 * (M34 U3). The server sends only what may be seen: no solution before its time.
 */
export function useStudyAhead(sessionId: string, item: ItemResponse | null) {
  const peek = useCallback((position: number) => fetchItem(sessionId, position), [sessionId]);
  return useItemsAhead(item, peek, warmPictures, AROUND);
}
