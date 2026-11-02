import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { BankResponse } from '../../../contracts/library.js';
import { Alert, Card, EmptyState, MutedText, Stack, Title } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBank } from './api.js';
import { BankDetailsCard } from './BankDetailsCard.js';
import { TaxonomyCard } from './TaxonomyCard.js';

/** Bank details (UI-06). Sources and question counts arrive with imports (M4, M6); no fake numbers. */
export function BankScreen() {
  const { t } = useI18n();
  const bankId = useParams()['bankId'] ?? '';
  const load = useCallback(() => fetchBank(bankId), [bankId]);
  const { state } = useQuery(load);
  const [edited, setBank] = useState<BankResponse | null>(null);
  const fetched = state.status === 'ready' ? state.data : null;
  const bank = edited?.id === fetched?.id ? edited : fetched;
  return (
    <Stack>
      <Link to="/">{t('bank.back')}</Link>
      {state.status === 'loading' && <MutedText>{t('common.loading')}</MutedText>}
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {bank && (
        <>
          <BankDetailsCard bank={bank} onChange={setBank} />
          <Card>
            <EmptyState title={t('bank.empty.title')} description={t('bank.empty.description')} />
          </Card>
          <TaxonomyCard bankId={bank.id} />
          <Card>
            <Title>{t('bank.sources.title')}</Title>
            <MutedText>{t('bank.sources.empty')}</MutedText>
          </Card>
        </>
      )}
    </Stack>
  );
}
