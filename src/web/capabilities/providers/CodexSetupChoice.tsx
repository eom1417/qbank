import type { InstanceConfig, ProviderView } from '../../../contracts/providers.js';
import { SelectField } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { codexSetupModeOf, setCodexSetupMode, type CodexSetupMode } from './instances.js';

interface Props {
  provider: ProviderView;
  config: InstanceConfig | undefined;
  onError(error: unknown): void;
}

/**
 * How Codex signs in (the kit's setup modes): the Codex already signed in on this computer, or
 * QBank's own copy signed in with ChatGPT from this screen, with no terminal (managed mode).
 */
export function CodexSetupChoice({ provider, config, onError }: Props) {
  const { t } = useI18n();
  // The built-in Codex instance has no stored settings until its first change.
  const current = config ?? { driver: provider.driver, enabled: provider.enabled };
  const change = useAction(async (mode: CodexSetupMode) => {
    await setCodexSetupMode(provider.instanceId, current, mode).catch(onError);
  });
  if (provider.driver !== 'codex') return null;
  return (
    <SelectField
      label={t('providers.codex.setup')}
      value={codexSetupModeOf(current)}
      disabled={change.busy}
      onChange={(event) => void change.run(event.target.value as CodexSetupMode)}
      options={[
        { value: 'existing', label: t('providers.codex.existing') },
        { value: 'managed', label: t('providers.codex.managed') },
      ]}
    />
  );
}
