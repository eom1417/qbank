import { Link } from 'react-router';
import { buttonClass } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** The way from a bank to its duplicate and similar questions (UI-06 → UI-12). */
export function DuplicatesLink({ bankId }: { bankId: string }) {
  const { t } = useI18n();
  return (
    <Link className={buttonClass('secondary')} to={`/banks/${bankId}/duplicates`}>
      {t('duplicates.link')}
    </Link>
  );
}
