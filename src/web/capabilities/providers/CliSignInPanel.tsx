import { useState } from 'react';
import type {
  CliLoginMethod,
  CliProvider,
  InstanceConfig,
  ProviderView,
} from '../../../contracts/providers.js';
import {
  Button,
  ConfirmButton,
  MutedText,
  Stack,
  Subtitle,
  TextField,
} from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { cliLogout, useCliLogin, type CliLogin } from './cli-login.js';
import { CliLoginSteps } from './CliLoginSteps.js';
import { codexSetupModeOf, refreshInstance } from './instances.js';

/** The ways each provider signs in; the first is the recommended one. */
const METHODS: Record<CliProvider, readonly CliLoginMethod[]> = {
  codex: ['codex.chatgpt', 'codex.apiKey'],
  claude: ['claude.subscription', 'claude.console'],
};

/** Codex in its own-CLI mode and Claude sign in this way; the kit signs in the others itself. */
export function cliOf(
  provider: ProviderView,
  config: InstanceConfig | undefined,
): CliProvider | null {
  if (provider.driver === 'claudeAgent') return 'claude';
  if (provider.driver !== 'codex') return null;
  const current = config ?? { driver: provider.driver, enabled: provider.enabled };
  return codexSetupModeOf(current) === 'existing' ? 'codex' : null;
}

/** An API key, typed once and sent straight to the CLI; QBank never shows or keeps it. */
function ApiKeyForm({ flow }: { flow: CliLogin }) {
  const { t } = useI18n();
  const [key, setKey] = useState('');
  return (
    <Stack>
      <TextField
        type="password"
        autoComplete="off"
        label={t('cliLogin.apiKey')}
        value={key}
        onChange={(event) => setKey(event.target.value)}
      />
      <Button disabled={!key.trim()} onClick={() => void flow.start('codex.apiKey', key.trim())}>
        {t('cliLogin.saveKey')}
      </Button>
    </Stack>
  );
}

function Methods({ cli, flow }: { cli: CliProvider; flow: CliLogin }) {
  const { t } = useI18n();
  const [keyForm, setKeyForm] = useState(false);
  if (keyForm) return <ApiKeyForm flow={flow} />;
  return (
    <Stack>
      {METHODS[cli].map((method, index) => (
        <Stack key={method}>
          <Button
            variant={index === 0 ? 'primary' : 'secondary'}
            onClick={() => (method === 'codex.apiKey' ? setKeyForm(true) : void flow.start(method))}
          >
            {t(`cliLogin.method.${method}`)}
          </Button>
          <MutedText>{t(`cliLogin.method.${method}.hint`)}</MutedText>
        </Stack>
      ))}
    </Stack>
  );
}

/** Signing in from any device through the provider's own CLI, and signing out again. */
export function CliSignInPanel(props: {
  provider: ProviderView;
  config: InstanceConfig | undefined;
  onError(error: unknown): void;
}) {
  const { t } = useI18n();
  const { provider, onError } = props;
  const flow = useCliLogin(provider.instanceId, onError);
  const signOut = useAction(async (cli: CliProvider) => {
    await cliLogout(cli);
    await refreshInstance(provider.instanceId);
  });
  const cli = cliOf(provider, props.config);
  if (!cli || !provider.installed) return null;
  if (flow.login) return <CliLoginSteps login={flow.login} flow={flow} />;
  if (provider.auth.status === 'authenticated')
    return (
      <ConfirmButton
        label={t('cliLogin.signOut')}
        confirmLabel={t('cliLogin.signOut.confirm')}
        busy={signOut.busy}
        onConfirm={() => void signOut.run(cli)}
      />
    );
  return (
    <Stack>
      <Subtitle>{t('cliLogin.title')}</Subtitle>
      <MutedText>{t('cliLogin.lead')}</MutedText>
      <Methods cli={cli} flow={flow} />
    </Stack>
  );
}
