import type { Rate } from '../../../contracts/analytics.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** A rate as everywhere: "8 out of 10 (80%)", or that there is nothing yet (M12.1). */
export function RateText({ rate }: { rate: Rate }) {
  const { t } = useI18n();
  if (rate.percent === null) return <>{t('analytics.noData')}</>;
  return (
    <>
      {rate.part} {t('analytics.outOf')} {rate.whole} ({rate.percent}%)
    </>
  );
}
