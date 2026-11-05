import { useState } from 'react';
import type { ChannelView } from '../../../contracts/channels.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmButton,
  MutedText,
  Row,
  Stack,
  Title,
} from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { deleteChannel, renewKey, setPaused } from './api.js';
import { ChannelStatsView } from './ChannelStatsView.js';

interface Props {
  channel: ChannelView;
  onChanged(): void;
  /** A new key to show once. */
  onNewKey(key: string): void;
}

/** One channel: its state and key prefix, pause, a new key, delete, and its own numbers. */
export function ChannelCard({ channel, onChanged, onNewKey }: Props) {
  const { t, locale } = useI18n();
  const [showStats, setShowStats] = useState(false);
  const act = useAction(async (work: () => Promise<unknown>) => {
    await work();
    onChanged();
  });
  const used = channel.lastUsedAt
    ? `${t('channels.lastUsed')}: ${new Date(channel.lastUsedAt).toLocaleString(locale)}`
    : t('channels.neverUsed');
  return (
    <Card>
      <Stack>
        <Row>
          <Title>
            <bdi>{channel.name}</bdi>
          </Title>
          <Badge>{t(channel.paused ? 'channels.paused' : 'channels.active')}</Badge>
        </Row>
        <MutedText>
          {t('channels.key.prefix')}: <bdi>{channel.keyPrefix}…</bdi> · {used}
        </MutedText>
        {act.error && <Alert tone="error">{t(act.error)}</Alert>}
        <Row>
          <Button
            variant="secondary"
            busy={act.busy}
            onClick={() => void act.run(() => setPaused(channel.id, !channel.paused))}
          >
            {t(channel.paused ? 'channels.resume' : 'channels.pause')}
          </Button>
          <ConfirmButton
            label={t('channels.renew')}
            confirmLabel={t('channels.renewConfirm')}
            onConfirm={() => void act.run(async () => onNewKey((await renewKey(channel.id)).key))}
          />
          <ConfirmButton
            label={t('channels.delete')}
            confirmLabel={t('channels.deleteConfirm')}
            onConfirm={() => void act.run(() => deleteChannel(channel.id))}
          />
          <Button variant="ghost" onClick={() => setShowStats(!showStats)}>
            {t(showStats ? 'channels.stats.hide' : 'channels.stats.show')}
          </Button>
        </Row>
        {showStats && <ChannelStatsView id={channel.id} />}
      </Stack>
    </Card>
  );
}
