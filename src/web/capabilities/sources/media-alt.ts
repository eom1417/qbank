import type { MediaListResponse } from '../../../contracts/sources.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';

type Media = MediaListResponse['media'][number];

/**
 * A neutral description (FR-06-007): what the stem calls the picture and which question it
 * belongs to, never anything from the options or the answer.
 */
export function useMediaAlt() {
  const { t } = useI18n();
  return (media: Media) =>
    `${t(`media.kind.${media.modality ?? media.kind}` as MessageKey)} — ${t('media.question')} ${media.questionNumber}`;
}
