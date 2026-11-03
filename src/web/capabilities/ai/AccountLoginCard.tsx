import { useEffect, useState } from 'react';
import type { AccountLoginResponse, AccountProvider } from '../../../contracts/ai.js';
import { Alert, Button, Card, Checkbox, MutedText, Row, Title } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { DisclosureNote } from './AiAboutCard.js';
import { LoginSteps } from './LoginSteps.js';
import { fetchAccountLogin, startAccountLogin } from './api.js';

const POLL_MS = 2000;
const ACTIVE = new Set(['waiting', 'awaiting_code']);

/** Polls a sign-in in progress until it finishes; `onDone` runs once it completed. */
function usePolledLogin(onDone: () => void) {
  const [login, setLogin] = useState<AccountLoginResponse | null>(null);
  useEffect(() => {
    if (!login || !ACTIVE.has(login.status)) return;
    const timer = setTimeout(() => {
      void fetchAccountLogin(login.id).then(setLogin, () => undefined);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [login]);
  useEffect(() => {
    if (login?.status === 'completed') onDone();
  }, [login?.status, onDone]);
  return { login, setLogin };
}

/**
 * Sign in with a Claude or ChatGPT subscription (no API key): the official CLI runs on this
 * server under the user's own account; the user approves in their browser.
 */
export function AccountLoginCard({ onAdded }: { onAdded(): void }) {
  const { t } = useI18n();
  const [agreed, setAgreed] = useState(false);
  const { login, setLogin } = usePolledLogin(onAdded);
  const start = useAction(async (provider: AccountProvider) =>
    setLogin(await startAccountLogin(provider)),
  );
  const busy = login !== null && ACTIVE.has(login.status);
  return (
    <Card>
      <Title>{t('ai.account.title')}</Title>
      <MutedText>{t('ai.account.intro')}</MutedText>
      <Alert tone="info">{t('ai.account.claudeTerms')}</Alert>
      <DisclosureNote />
      <Checkbox
        checked={agreed}
        onChange={(event) => setAgreed(event.target.checked)}
        label={t('ai.account.ack')}
      />
      {start.error && <Alert tone="error">{t(start.error)}</Alert>}
      {!busy && (
        <Row>
          <Button disabled={!agreed} busy={start.busy} onClick={() => void start.run('claude')}>
            {t('ai.account.claude')}
          </Button>
          <Button disabled={!agreed} busy={start.busy} onClick={() => void start.run('codex')}>
            {t('ai.account.codex')}
          </Button>
        </Row>
      )}
      {login && <LoginSteps login={login} onChange={setLogin} />}
    </Card>
  );
}
