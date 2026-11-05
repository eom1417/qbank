import { useState } from 'react';
import { Alert, Button, CodeText, MutedText, Row, Stack } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** A new channel key, shown this once with a copy button and the call an agent makes. */
export function NewKeyNotice({ channelKey }: { channelKey: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const call = `curl -X POST ${window.location.origin}/api/channel/v1/batches -H "Authorization: Bearer ${channelKey}"`;
  return (
    <Alert tone="info">
      <Stack>
        <strong>{t('channels.key.title')}</strong>
        <MutedText>{t('channels.key.once')}</MutedText>
        <Row>
          <CodeText>{channelKey}</CodeText>
          <Button
            variant="ghost"
            onClick={() =>
              void navigator.clipboard.writeText(channelKey).then(() => setCopied(true))
            }
          >
            {t(copied ? 'channels.key.copied' : 'channels.key.copy')}
          </Button>
        </Row>
        <MutedText>{t('channels.key.example')}</MutedText>
        <CodeText>{call}</CodeText>
      </Stack>
    </Alert>
  );
}
