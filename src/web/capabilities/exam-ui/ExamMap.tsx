import { Button, Row, Stack, Subtitle } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** One number of the map: where it is, and whether it is answered or flagged. */
export interface MapItem {
  position: number;
  answered: boolean;
  flagged: boolean;
}

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
export function ExamMap<T extends MapItem>({
  items,
  current,
  canGo,
  onGo,
}: {
  items: readonly T[];
  current: number;
  canGo(item: T): boolean;
  onGo(position: number): void;
}) {
  const { t } = useI18n();
  return (
    <Stack>
      <Subtitle>{t('exam.map')}</Subtitle>
      <Row>
        {items.map((item) => (
          <Button
            key={item.position}
            variant={item.position === current ? 'primary' : 'secondary'}
            disabled={!canGo(item)}
            onClick={() => onGo(item.position)}
          >
            {labelOf(item, t)}
          </Button>
        ))}
      </Row>
    </Stack>
  );
}
