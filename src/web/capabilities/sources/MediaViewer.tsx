import { useState } from 'react';
import type { MediaListResponse } from '../../../contracts/sources.js';
import { Button, Dialog, Row, ZoomableImage } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { mediaSrc } from './api.js';
import { useMediaAlt } from './media-alt.js';

type Media = MediaListResponse['media'][number];

const ZOOMS = [1, 1.5, 2, 3, 4];

interface ViewerProps {
  media: Media | null;
  onClose(): void;
}

/** One picture full size, enlarged in steps without distortion, panned by scrolling (M5.7). */
export function MediaViewer({ media, onClose }: ViewerProps) {
  const { t } = useI18n();
  const alt = useMediaAlt();
  const [step, setStep] = useState(0);
  const close = () => {
    setStep(0);
    onClose();
  };
  return (
    <Dialog
      open={media !== null}
      title={media ? alt(media) : ''}
      closeLabel={t('media.close')}
      onClose={close}
    >
      <Row>
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
          {t('media.zoomOut')}
        </Button>
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep(0)}>
          {t('media.zoomFit')}
        </Button>
        <Button
          variant="secondary"
          disabled={step === ZOOMS.length - 1}
          onClick={() => setStep(step + 1)}
        >
          {t('media.zoomIn')}
        </Button>
      </Row>
      {media && <ZoomableImage src={mediaSrc(media.id)} alt={alt(media)} zoom={ZOOMS[step] ?? 1} />}
    </Dialog>
  );
}
