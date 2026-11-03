import type { InstanceConfig } from '../../../contracts/providers.js';
import { kitCall } from './api.js';

/** An instance change is a settings write in the kit; the stored config is kept whole. */
function write(operation: 'create' | 'upsert', instanceId: string, instance: InstanceConfig) {
  return kitCall('server.updateSettings', {
    patch: {},
    providerInstanceMutation: { operation, instanceId, instance },
  });
}

export const setEnabled = (instanceId: string, current: InstanceConfig, enabled: boolean) =>
  write('upsert', instanceId, { ...current, enabled });

export const removeInstance = (instanceId: string) =>
  kitCall('server.updateSettings', {
    patch: {},
    providerInstanceMutation: { operation: 'remove', instanceId },
  });

/** A new instance of a driver, with its API-key fields as sensitive environment values. */
export function addInstance(driver: string, name: string, environment: Record<string, string>) {
  const instanceId = `${driver}-${crypto.randomUUID().slice(0, 8)}`;
  const variables = Object.entries(environment)
    .filter(([, value]) => value.trim() !== '')
    .map(([variable, value]) => ({ name: variable, value, sensitive: true }));
  return write('create', instanceId, {
    driver,
    enabled: true,
    ...(name.trim() ? { displayName: name.trim() } : {}),
    ...(variables.length > 0 ? { environment: variables } : {}),
  });
}

export const refreshInstance = (instanceId: string) =>
  kitCall('server.refreshProviders', { instanceId, refreshModels: true });
