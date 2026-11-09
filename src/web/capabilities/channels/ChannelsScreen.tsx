import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { ShareSecretResponse } from '../../../contracts/sharing.js';
import {
  Alert,
  Button,
  EmptyState,
  Heading,
  MutedText,
  Row,
  Stack,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchShares } from './api.js';
import { NewShareFlow } from './NewShareFlow.js';
import { SecretNotice } from './SecretNotice.js';
import { ShareItem } from './ShareItem.js';

/** A bank's sharing (M30, DEC-39): every share with its rules, controls, record and results. */
export function ChannelsScreen() {
  const { t } = useI18n();
  const bankId = useParams()['bankId'] ?? '';
  const { state, reload } = useQuery(useCallback(() => fetchShares(bankId), [bankId]));
  const [secret, setSecret] = useState<ShareSecretResponse | null>(null);
  const [adding, setAdding] = useState(false);
  const shown = (created: ShareSecretResponse) => {
    setSecret(created);
    setAdding(false);
    reload();
  };
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  const { shares } = state.data;
  return (
    <Stack>
      <Link to={`/banks/${bankId}`}>{t('review.back')}</Link>
      <Heading>{t('sharing.title')}</Heading>
      <MutedText>{t('sharing.lead')}</MutedText>
      {secret && <SecretNotice created={secret} onDone={() => setSecret(null)} />}
      {adding ? (
        <NewShareFlow bankId={bankId} onCancel={() => setAdding(false)} onCreated={shown} />
      ) : (
        <Row>
          <Button onClick={() => setAdding(true)}>{t('sharing.new')}</Button>
        </Row>
      )}
      {shares.length === 0 && !adding && (
        <EmptyState title={t('sharing.title')} description={t('sharing.empty')} />
      )}
      {shares.map((share) => (
        <ShareItem key={share.id} share={share} onChanged={reload} onSecret={shown} />
      ))}
    </Stack>
  );
}

/** The way from a bank to its sharing. */
export function ChannelsLink({ bankId }: { bankId: string }) {
  const { t } = useI18n();
  return <Link to={`/banks/${bankId}/channels`}>{t('channels.open')}</Link>;
}
