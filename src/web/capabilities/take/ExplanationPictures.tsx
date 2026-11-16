import { PictureGrid } from '../exam-ui/QuestionCard.js';
import type { AttemptApi } from './api.js';
import { usePictures } from './use-pictures.js';

/**
 * The explanation's own pictures (M34), shown only where the server revealed the explanation:
 * in a practice's feedback or a result that explains.
 */
export function ExplanationPictures({
  api,
  ids,
}: {
  api: Pick<AttemptApi, 'picture'>;
  ids: readonly string[];
}) {
  return <PictureGrid ids={ids} pictureUrl={usePictures(api, ids)} />;
}
