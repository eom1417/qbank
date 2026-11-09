import { Card, Subtitle } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** A count and what it is out of: rates never hide their denominator (FR-12-010). */
export function CountCard({ label, value, of }: { label: string; value: number; of: number }) {
  const { t } = useI18n();
  return (
    <Card>
      <Subtitle>{label}</Subtitle>
      <p>
        {value} {t('study.summary.outOf')} {of}
      </p>
    </Card>
  );
}
