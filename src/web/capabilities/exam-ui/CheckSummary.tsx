import { Alert, Card, MutedText } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import type { MapItem } from './ExamMap.js';

/**
 * The counts before submitting (FR-13-010, UAT-054): answered, unanswered and flagged, and a
 * warning when some questions have no answer.
 */
export function CheckSummary({ items }: { items: readonly MapItem[] }) {
  const { t } = useI18n();
  const unanswered = items.filter((i) => !i.answered).length;
  return (
    <>
      <Card>
        <MutedText>
          {t('exam.check.answered')} {items.length - unanswered} · {t('exam.check.unanswered')}{' '}
          {unanswered} · {t('exam.check.flagged')} {items.filter((i) => i.flagged).length}
        </MutedText>
      </Card>
      {unanswered > 0 && <Alert tone="info">{t('exam.check.warning')}</Alert>}
    </>
  );
}
