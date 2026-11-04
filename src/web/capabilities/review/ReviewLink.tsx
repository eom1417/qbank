import { Link } from 'react-router';
import { buttonClass } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** The way from a bank to its review queue (UI-06 → UI-10). */
export function ReviewLink({ bankId }: { bankId: string }) {
  const { t } = useI18n();
  return (
    <Link className={buttonClass('secondary')} to={`/banks/${bankId}/review`}>
      {t('review.link')}
    </Link>
  );
}
