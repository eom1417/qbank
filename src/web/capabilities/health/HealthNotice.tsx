import { Link } from 'react-router';
import { Alert } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchHealth } from './api.js';

/** On the home screen, only when something needs attention; quiet otherwise (M17.3). */
export function HealthNotice() {
  const { t } = useI18n();
  const { state } = useQuery(fetchHealth);
  if (state.status !== 'ready' || state.data.problems.length === 0) return null;
  const [first] = state.data.problems;
  return (
    <Alert tone="info">
      {t(`health.problem.${first ?? 'ai_unreachable'}`)}{' '}
      <Link to="/settings">{t('health.open')}</Link>
    </Alert>
  );
}
