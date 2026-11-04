import { useState } from 'react';
import type { CliLoginView } from '../../../contracts/providers.js';
import {
  Alert,
  Button,
  buttonClass,
  CodeText,
  MutedText,
  Row,
  Stack,
  TextField,
} from '../../design-system/index.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import type { CliLogin } from './cli-login.js';

/** QBank's own reasons in the owner's language; anything else is the CLI's own words. */
const REASONS: Record<string, MessageKey> = {
  cancelled: 'cliLogin.cancelled',
  replaced: 'cliLogin.replaced',
  cli_unavailable: 'cliLogin.unavailable',
};

/** The code to type on the provider's page, large, with a copy button. */
function DeviceCode({ code }: { code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Stack>
      <MutedText>{t('cliLogin.enterCode')}</MutedText>
      <Row>
        <CodeText>{code}</CodeText>
        <Button
          variant="ghost"
          onClick={() => void navigator.clipboard.writeText(code).then(() => setCopied(true))}
        >
          {t(copied ? 'support.copied' : 'cliLogin.copy')}
        </Button>
      </Row>
    </Stack>
  );
}

/** The code the provider's page shows after approval, pasted back here. */
function PasteCode({ id, flow }: { id: string; flow: CliLogin }) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  return (
    <Stack>
      <TextField
        label={t('cliLogin.pasteCode')}
        hint={t('cliLogin.pasteHint')}
        value={code}
        autoComplete="off"
        onChange={(event) => setCode(event.target.value)}
      />
      <Button disabled={!code.trim()} onClick={() => void flow.sendCode(id, code.trim())}>
        {t('cliLogin.confirm')}
      </Button>
    </Stack>
  );
}

function Waiting({ login, flow }: { login: CliLoginView; flow: CliLogin }) {
  const { t } = useI18n();
  if (login.status === 'starting') return <MutedText>{t('cliLogin.preparing')}</MutedText>;
  if (login.status === 'verifying') return <MutedText>{t('cliLogin.verifying')}</MutedText>;
  return (
    <Stack>
      {login.link && (
        <a className={buttonClass()} href={login.link} target="_blank" rel="noreferrer noopener">
          {t('cliLogin.open')}
        </a>
      )}
      {login.userCode && <DeviceCode code={login.userCode} />}
      {login.needsCode ? (
        <PasteCode id={login.id} flow={flow} />
      ) : (
        <MutedText>{t('cliLogin.waiting')}</MutedText>
      )}
    </Stack>
  );
}

/** A sign-in under way, or how it ended, with a way out either way. */
export function CliLoginSteps({ login, flow }: { login: CliLoginView; flow: CliLogin }) {
  const { t } = useI18n();
  if (login.status === 'done') return <Alert tone="success">{t('cliLogin.done')}</Alert>;
  if (!flow.active) {
    const reason = login.status === 'expired' ? 'cliLogin.expired' : REASONS[login.message ?? ''];
    return (
      <Stack>
        <Alert tone="error">{reason ? t(reason) : login.message || t('cliLogin.failed')}</Alert>
        <Button variant="secondary" onClick={flow.close}>
          {t('cliLogin.again')}
        </Button>
      </Stack>
    );
  }
  return (
    <Stack>
      <Waiting login={login} flow={flow} />
      <Button variant="ghost" onClick={() => void flow.cancel(login.id)}>
        {t('signIn.cancel')}
      </Button>
    </Stack>
  );
}
