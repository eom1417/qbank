import { useCallback, useState } from 'react';
import { PairingCodeResponse } from '../../../contracts/identity.js';
import { Button, Card, CodeText, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useSession } from './session.js';

/** The link that opens this local QBank on another device (DEC-31). Local mode only. */
export function DevicesCard() {
  const { mode } = useSession();
  return mode === 'local' ? <PairingLink /> : null;
}

function PairingLink() {
  const { t } = useI18n();
  const load = useCallback(() => apiRequest('GET', '/api/local/pairing', PairingCodeResponse), []);
  const { state } = useQuery(load);
  const [copied, setCopied] = useState(false);
  if (state.status !== 'ready') return null;
  const link = `${window.location.origin}/#pair=${state.data.code}`;
  const copy = () => void navigator.clipboard.writeText(link).then(() => setCopied(true));
  return (
    <Card>
      <Stack>
        <Subtitle>{t('local.devices.title')}</Subtitle>
        <MutedText>{t('local.devices.lead')}</MutedText>
        <CodeText>{link}</CodeText>
        <Button variant="secondary" onClick={copy}>
          {t(copied ? 'local.devices.copied' : 'local.devices.copy')}
        </Button>
      </Stack>
    </Card>
  );
}
