import type { ExamStateResponse } from '../../../contracts/study.js';
import { Button, Row, Stack, Subtitle } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

type MapItem = ExamStateResponse['items'][number];

/** A symbol and words with each number, never colour alone (FR-13-008). */
function labelOf(
  item: MapItem,
  t: (key: 'exam.map.answered' | 'exam.map.flagged' | 'exam.map.empty') => string,
) {
  const parts = [item.answered ? `✓ ${t('exam.map.answered')}` : `– ${t('exam.map.empty')}`];
  if (item.flagged) parts.push(`⚑ ${t('exam.map.flagged')}`);
  return `${item.position + 1}: ${parts.join(' · ')}`;
}

/** The numbers of the exam, answered, empty and flagged, to move around as the rules allow. */
export function ExamMap({
  state,
  onGo,
}: {
  state: ExamStateResponse;
  onGo(position: number): void;
}) {
  const { t } = useI18n();
  return (
    <Stack>
      <Subtitle>{t('exam.map')}</Subtitle>
      <Row>
        {state.items.map((item) => (
          <Button
            key={item.position}
            variant={item.position === state.position ? 'primary' : 'secondary'}
            disabled={!item.changeable && state.timing === 'per_question'}
            onClick={() => onGo(item.position)}
          >
            {labelOf(item, t)}
          </Button>
        ))}
      </Row>
    </Stack>
  );
}
