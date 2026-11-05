import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, EmptyState, Heading, MutedText, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchChannels } from './api.js';
import { ChannelCard } from './ChannelCard.js';
import { NewChannelForm } from './NewChannelForm.js';
import { NewKeyNotice } from './NewKeyNotice.js';

/** A bank's publishing channels (M23, DEC-36): set up, keys shown once, each one's numbers. */
export function ChannelsScreen() {
  const { t } = useI18n();
  const bankId = useParams()['bankId'] ?? '';
  const { state, reload } = useQuery(useCallback(() => fetchChannels(bankId), [bankId]));
  const [newKey, setNewKey] = useState<string | null>(null);
  const keyShown = (key: string) => {
    setNewKey(key);
    reload();
  };
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  const { channels } = state.data;
  return (
    <Stack>
      <Link to={`/banks/${bankId}`}>{t('review.back')}</Link>
      <Heading>{t('channels.title')}</Heading>
      <MutedText>{t('channels.lead')}</MutedText>
      {newKey && <NewKeyNotice channelKey={newKey} />}
      {channels.length === 0 && (
        <EmptyState title={t('channels.title')} description={t('channels.empty')} />
      )}
      {channels.map((channel) => (
        <ChannelCard key={channel.id} channel={channel} onChanged={reload} onNewKey={keyShown} />
      ))}
      <NewChannelForm bankId={bankId} onCreated={keyShown} />
    </Stack>
  );
}

/** The way from a bank to its channels. */
export function ChannelsLink({ bankId }: { bankId: string }) {
  const { t } = useI18n();
  return <Link to={`/banks/${bankId}/channels`}>{t('channels.open')}</Link>;
}
