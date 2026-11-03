import { useCallback, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { BankResponse } from '../../../contracts/library.js';
import { Alert, MutedText, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBank } from './api.js';
import { BankDetailsCard } from './BankDetailsCard.js';
import { TaxonomyCard } from './TaxonomyCard.js';

interface Props {
  /** The bank's sources and import entry, composed in by the app (another capability). */
  sources?(bankId: string): ReactNode;
}

/** Bank details (UI-06): its details, taxonomy and, from the app, its sources. */
export function BankScreen({ sources }: Props) {
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
          {sources?.(bank.id)}
          <TaxonomyCard bankId={bank.id} />
        </>
      )}
    </Stack>
  );
}
