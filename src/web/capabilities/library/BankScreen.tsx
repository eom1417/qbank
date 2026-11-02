import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Heading,
  MutedText,
  Stack,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBank } from './api.js';

export function BankScreen() {
  const { t, locale } = useI18n();
  const bankId = useParams()['bankId'] ?? '';
  const load = useCallback(() => fetchBank(bankId), [bankId]);
  const { state } = useQuery(load);
  return (
    <Stack>
      <Link to="/">{t('bank.back')}</Link>
      {state.status === 'loading' && <MutedText>{t('common.loading')}</MutedText>}
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {state.status === 'ready' && (
        <>
          <Heading>{state.data.name}</Heading>
          {state.data.archived && <Badge>{t('library.archived')}</Badge>}
          {state.data.subject && <MutedText>{state.data.subject}</MutedText>}
          {state.data.description && <p>{state.data.description}</p>}
          <MutedText>
            {t('bank.created')}: {new Date(state.data.createdAt).toLocaleDateString(locale)}
          </MutedText>
          <Card>
            <EmptyState title={t('bank.empty.title')} description={t('bank.empty.description')} />
          </Card>
        </>
      )}
    </Stack>
  );
}
