import type { AccountLoginResponse } from '../../../contracts/ai.js';
import { Alert, Badge, Button, MutedText, Row, TextField } from '../../design-system/index.js';
import { text, useAction, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { cancelAccountLogin, submitLoginCode } from './api.js';

interface Props {
  login: AccountLoginResponse;
  onChange(login: AccountLoginResponse | null): void;
}

const OUTCOMES: Record<string, MessageKey> = {
  completed: 'ai.account.completed',
  cancelled: 'ai.account.cancelled',
  expired: 'ai.account.expired',
  login_failed: 'ai.account.failed',
  login_unavailable: 'ai.account.unavailable',
};

function CodeForm({ login, onChange }: Props) {
  const { t } = useI18n();
  const form = useSubmit(async (data) =>
    onChange(await submitLoginCode(login.id, text(data, 'code'))),
  );
  return (
    <form className="qb-row" onSubmit={form.onSubmit} noValidate>
      <TextField name="code" required autoComplete="off" dir="ltr" label={t('ai.account.code')} />
      <Button type="submit" busy={form.busy}>
        {t('ai.account.submitCode')}
      </Button>
      {form.error && <Alert tone="error">{t(form.error)}</Alert>}
    </form>
  );
}

/** The steps of one sign-in: open the provider's page, then paste or enter the code. */
export function LoginSteps({ login, onChange }: Props) {
  const { t } = useI18n();
  const cancel = useAction(async () => {
    await cancelAccountLogin(login.id);
    onChange(null);
  });
  const outcome = OUTCOMES[login.error ?? login.status];
  if (outcome) {
    return <Alert tone={login.status === 'completed' ? 'success' : 'error'}>{t(outcome)}</Alert>;
  }
  return (
    <>
      {login.authUrl && (
        <a href={login.authUrl} target="_blank" rel="noreferrer">
          {t(login.provider === 'claude' ? 'ai.account.openClaude' : 'ai.account.openCodex')}
        </a>
      )}
      {login.deviceCode && (
        <MutedText>
          {t('ai.account.deviceCode')}:{' '}
          <Badge>
            <bdi>{login.deviceCode}</bdi>
          </Badge>
        </MutedText>
      )}
      {login.status === 'awaiting_code' ? (
        <CodeForm login={login} onChange={onChange} />
      ) : (
        <MutedText>{t('ai.account.waiting')}</MutedText>
      )}
      <Row>
        <Button variant="ghost" busy={cancel.busy} onClick={() => void cancel.run()}>
          {t('ai.account.cancel')}
        </Button>
      </Row>
    </>
  );
}
