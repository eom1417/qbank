import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, EmptyState, Heading, MutedText, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchPairs } from './api.js';
import { PairCard } from './PairCard.js';

/** The bank's duplicate and similar questions, to compare and decide (UI-12, JY-06). */
export function DuplicatesScreen() {
  const { t } = useI18n();
  const bankId = useParams()['bankId'] ?? '';
  const load = useCallback(() => fetchPairs(bankId), [bankId]);
  const { state, reload } = useQuery(load);
  return (
    <Stack>
      <Link to={`/banks/${bankId}`}>{t('review.back')}</Link>
      <Heading>{t('duplicates.title')}</Heading>
      <MutedText>{t('duplicates.lead')}</MutedText>
      {state.status === 'loading' && <MutedText>{t('common.loading')}</MutedText>}
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {state.status === 'ready' && state.data.pairs.length === 0 && (
        <EmptyState title={t('duplicates.empty')} description={t('duplicates.lead')} />
      )}
      {state.status === 'ready' &&
        state.data.pairs.map((pair) => <PairCard key={pair.id} pair={pair} onDecided={reload} />)}
    </Stack>
  );
}
