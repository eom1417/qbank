import { Link } from 'react-router';
import { buttonClass } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** The way from a bank to studying it (UI-06 → UI-13). */
export function StudyLink({ bankId }: { bankId: string }) {
  const { t } = useI18n();
  return (
    <Link className={buttonClass()} to={`/study?bank=${bankId}`}>
      {t('study.link')}
    </Link>
  );
}
