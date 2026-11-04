import { useCallback, useState } from 'react';
import { PairingCodeResponse } from '../../../contracts/identity.js';
import {
  Alert,
  Button,
  Card,
  ConfirmButton,
  CodeText,
  MutedText,
  QrCode,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useSession } from './session.js';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The link that opens this local QBank on another device (DEC-31). Local mode only. */
export function DevicesCard() {
  const { mode } = useSession();
  return mode === 'local' ? <PairingLink /> : null;
}

/**
 * A phone cannot open "localhost": from this computer the link uses the network address when
 * QBank shares it (`--lan`); otherwise it is the address this browser already uses.
 */
function originFor(pairing: PairingCodeResponse) {
  const here = window.location;
  if (!LOOPBACK.has(here.hostname)) return { origin: here.origin, reachable: true };
  return pairing.lanOrigin
    ? { origin: pairing.lanOrigin, reachable: true }
    : { origin: here.origin, reachable: false };
}

function PairingLink() {
  const { t } = useI18n();
  const load = useCallback(() => apiRequest('GET', '/api/local/pairing', PairingCodeResponse), []);
  const { state, reload } = useQuery(load);
  const [copied, setCopied] = useState(false);
  const signOutOthers = useAction(async () => {
    await apiRequest('POST', '/api/local/devices/sign-out-others', PairingCodeResponse);
    setCopied(false);
    reload();
  });
  if (state.status !== 'ready') return null;
  const { origin, reachable } = originFor(state.data);
  const link = `${origin}/#pair=${state.data.code}`;
  const copy = () => void navigator.clipboard.writeText(link).then(() => setCopied(true));
  return (
    <Card>
      <Stack>
        <Subtitle>{t('local.devices.title')}</Subtitle>
        <MutedText>{t('local.devices.lead')}</MutedText>
        {reachable ? (
          <QrCode value={link} label={t('local.devices.qr')} />
        ) : (
          <Alert tone="info">{t('local.devices.lanOff')}</Alert>
        )}
        <CodeText>{link}</CodeText>
        <Button variant="secondary" onClick={copy}>
          {t(copied ? 'local.devices.copied' : 'local.devices.copy')}
        </Button>
        <MutedText>{t('local.devices.install')}</MutedText>
        <MutedText>{t('local.devices.revokeLead')}</MutedText>
        {signOutOthers.error && <Alert tone="error">{t(signOutOthers.error)}</Alert>}
        <ConfirmButton
          label={t('local.devices.revoke')}
          confirmLabel={t('local.devices.revoke.confirm')}
          busy={signOutOthers.busy}
          onConfirm={() => void signOutOthers.run()}
        />
      </Stack>
    </Card>
  );
}
