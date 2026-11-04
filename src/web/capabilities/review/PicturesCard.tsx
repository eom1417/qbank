import type { QuestionResponse } from '../../../contracts/questions.js';
import {
  Card,
  Grid,
  MutedText,
  Stack,
  Subtitle,
  ZoomableImage,
} from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** The question's figures and tables as kept (M5); an uncertain link is said, not hidden. */
export function PicturesCard({ question }: { question: QuestionResponse }) {
  const { t } = useI18n();
  if (question.pictures.length === 0) return null;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('editor.pictures')}</Subtitle>
        <Grid>
          {question.pictures.map((picture) => (
            <Stack key={picture.id}>
              <ZoomableImage src={`/api/media/${picture.id}`} alt={t('editor.pictures')} zoom={1} />
              {!picture.certain && <MutedText>{t('editor.pictureUncertain')}</MutedText>}
              {picture.lowQuality && <MutedText>{t('review.reason.media_low_quality')}</MutedText>}
            </Stack>
          ))}
        </Grid>
      </Stack>
    </Card>
  );
}
