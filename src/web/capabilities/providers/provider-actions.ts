import type { InstanceConfig, ProviderView } from '../../../contracts/providers.js';
import type { MessageKey } from '../../platform/i18n/i18n.js';
import { kitCall } from './api.js';
import { refreshInstance, setEnabled } from './instances.js';

export interface ProviderAction {
  key: string;
  label: MessageKey;
  variant: 'primary' | 'secondary' | 'ghost';
  /** Shown after the label, such as the version an update brings. */
  detail?: string;
  work: () => Promise<unknown>;
}

/** The maintenance a provider offers now: install when missing, update when one is out. */
function maintenance(provider: ProviderView): ProviderAction[] {
  const instanceId = provider.instanceId;
  const actions: ProviderAction[] = [];
  if (provider.setup?.canInstall && !provider.installed)
    actions.push({
      key: 'install',
      label: 'providers.install',
      variant: 'primary',
      work: () => kitCall('provider.install.start', { instanceId }),
    });
  if (provider.versionAdvisory?.canUpdate === true)
    actions.push({
      key: 'update',
      label: 'providers.update',
      variant: 'secondary',
      detail: provider.versionAdvisory.latestVersion ?? '',
      work: () => kitCall('server.updateProvider', { instanceId }),
    });
  if (provider.auth.status === 'authenticated' && provider.auth.canLogout !== false)
    actions.push({
      key: 'logout',
      label: 'providers.signOut',
      variant: 'ghost',
      work: () => kitCall('provider.auth.logout', { instanceId }),
    });
  return actions;
}

/** Every way in has its way out (INTEGRATION_GUIDE §8): on and off, check, install, update, sign out. */
export function providerActions(
  provider: ProviderView,
  config: InstanceConfig | undefined,
): ProviderAction[] {
  const current = config ?? { driver: provider.driver };
  return [
    {
      key: 'toggle',
      label: provider.enabled ? 'providers.disable' : 'providers.enable',
      variant: 'secondary',
      work: () => setEnabled(provider.instanceId, current, !provider.enabled),
    },
    {
      key: 'refresh',
      label: 'providers.refresh',
      variant: 'ghost',
      work: () => refreshInstance(provider.instanceId),
    },
    ...maintenance(provider),
  ];
}
