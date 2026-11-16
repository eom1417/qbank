import { useCallback, useEffect, useState } from 'react';
import type { TakeItemResponse } from '../../../contracts/take.js';
import type { AttemptApi } from './api.js';

type CardPictures = Pick<TakeItemResponse, 'pictureIds' | 'optionPictureIds' | 'case'>;

/** Every picture a question card shows (M34): the question's, its options' and its case's. */
export const cardPictureIds = (item: CardPictures): string[] => [
  ...(item.case?.pictures ?? []),
  ...item.pictureIds,
  ...Object.values(item.optionPictureIds).flat(),
];

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
