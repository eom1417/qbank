import { useCallback, useEffect, useState } from 'react';
import type { AttemptApi } from './api.js';

/**
 * A question's pictures, fetched with the attempt token and shown from local object
 * addresses, released when the question changes. A picture that fails stays out of view.
 */
export function usePictures(api: Pick<AttemptApi, 'picture'>, ids: readonly string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = ids.join(',');
  useEffect(() => {
    let active = true;
    const made: string[] = [];
    for (const id of key ? key.split(',') : []) {
      api.picture(id).then(
        (blob) => {
          if (!active) return;
          const url = URL.createObjectURL(blob);
          made.push(url);
          setUrls((all) => ({ ...all, [id]: url }));
        },
        () => undefined,
      );
    }
    return () => {
      active = false;
      made.forEach((url) => URL.revokeObjectURL(url));
      setUrls({});
    };
  }, [api, key]);
  return useCallback((id: string) => urls[id] ?? null, [urls]);
}
