import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AttemptApi } from './api.js';
import { pictureCache, type PictureCache } from './picture-cache.js';

/**
 * Pictures shown from the attempt's picture cache: those not there yet are fetched, and the
 * page shows each as it arrives. A picture that fails stays out of view.
 */
export function usePictures(cache: PictureCache, ids: readonly string[]) {
  const [, setArrived] = useState(0);
  const key = ids.join(',');
  useEffect(() => {
    let active = true;
    for (const id of key ? key.split(',') : [])
      if (cache.url(id) === null)
        void cache.load(id).then((url) => active && url && setArrived((n) => n + 1));
    return () => {
      active = false;
    };
  }, [cache, key]);
  // A new arrival re-renders the caller, which reads the cache afresh.
  return useCallback((id: string) => cache.url(id), [cache]);
}

/** A cache of its own for pictures shown apart from the questions, released when it goes. */
export function useOwnPictures(api: Pick<AttemptApi, 'picture'>, ids: readonly string[]) {
  const cache = useMemo(() => pictureCache((id) => api.picture(id)), [api]);
  useEffect(() => () => cache.release(), [cache]);
  return usePictures(cache, ids);
}
