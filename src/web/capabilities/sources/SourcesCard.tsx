import { useCallback } from 'react';
import { Link } from 'react-router';
import {
  Alert,
  buttonClass,
  Card,
  EmptyState,
  MutedText,
  Title,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchSources } from './api.js';
import { SourceItem } from './SourceItem.js';

/** A bank's sources and what came out of each (UI-23, FR-03-002): real counts only. */
export function SourcesCard({ bankId }: { bankId: string }) {
  const { t } = useI18n();
  const load = useCallback(() => fetchSources(bankId), [bankId]);
  const { state, reload } = useQuery(load);
  const importLink = (
    <Link className={buttonClass()} to={`/banks/${bankId}/import`}>
      {t('import.start')}
    </Link>
  );
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.data.sources.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t('bank.empty.title')}
          description={t('bank.empty.description')}
          action={importLink}
        />
      </Card>
    );
  }
  return (
    <Card>
      <Title>{t('bank.sources.title')}</Title>
      <ul className="qb-list">
        {state.data.sources.map((source) => (
          <SourceItem key={source.id} source={source} onChange={reload} />
        ))}
      </ul>
      {importLink}
    </Card>
  );
}
