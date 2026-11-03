import { ProviderSetupError, type ProviderInstanceId } from '@t3tools/contracts';
import * as Effect from 'effect/Effect';

import { ProviderInstanceRegistry } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/provider/ProviderInstanceRegistry.ts';
import { ProviderMaintenanceRunner } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/provider/providerMaintenanceRunner.ts';
import { ProviderRegistry } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/provider/ProviderRegistry.ts';
import { SecretResolver } from '@t3tools/secret-provider-core/server/SecretResolver';
import * as ServerSettings from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/serverSettings.ts';
import { invalidateSettingsSecrets } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/sourceControl/sourceControlHostSecrets.ts';
import { UsageLimitSources } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/usage/UsageLimitSources.ts';

interface RefreshInput {
  readonly instanceId?: ProviderInstanceId;
  readonly cwd?: string;
  readonly fresh?: boolean;
  readonly refreshModels?: boolean;
  readonly reloadSecrets?: boolean;
}

/** The registry refresh T3's `server.refreshProviders` runs (ws.ts 2370-2448). */
const refreshSnapshot = Effect.fnUntraced(function* (input: RefreshInput) {
  const registry = yield* ProviderRegistry;
  if (input.cwd !== undefined && input.instanceId !== undefined)
    return yield* registry.refreshWorkspaceSnapshot({
      instanceId: input.instanceId,
      cwd: input.cwd,
      fresh: input.fresh === true,
    });
  if (input.reloadSecrets === true)
    return yield* registry.reloadSecretsAndRefresh(input.instanceId);
  if (input.instanceId !== undefined) return yield* registry.refreshInstance(input.instanceId);
  return yield* registry.refresh();
});

/** Asks each enabled, installed instance for its live model list, as T3 does after a refresh. */
const refreshModels = Effect.fnUntraced(function* (
  input: RefreshInput,
  providers: ReadonlyArray<{
    readonly instanceId: ProviderInstanceId;
    readonly enabled: boolean;
    readonly installed: boolean;
  }>,
) {
  const registry = yield* ProviderRegistry;
  const instances = yield* ProviderInstanceRegistry;
  let current = providers;
  for (const instance of yield* instances.listInstances) {
    const wanted = input.instanceId === undefined || input.instanceId === instance.instanceId;
    const live = current.some(
      (p) => p.instanceId === instance.instanceId && p.enabled && p.installed,
    );
    if (!instance.refreshModels || !wanted || !live) continue;
    yield* instance.refreshModels().pipe(
      Effect.mapError(
        (error) =>
          new ProviderSetupError({
            instanceId: instance.instanceId,
            operation: 'refresh-models',
            detail: error.detail,
          }),
      ),
    );
    current = yield* registry.refreshInstance(instance.instanceId);
  }
  return current;
});

export const refreshProviders = Effect.fnUntraced(function* (input: RefreshInput) {
  const registry = yield* ProviderRegistry;
  if (input.refreshModels)
    yield* registry.invalidateModelCaches({
      instanceId: input.instanceId,
      cwd: input.cwd,
      fresh: input.fresh,
    });
  if (input.instanceId === undefined) yield* (yield* UsageLimitSources).refresh;
  if (input.reloadSecrets === true && input.instanceId === undefined) {
    const settings = yield* ServerSettings.ServerSettingsService;
    yield* invalidateSettingsSecrets(yield* SecretResolver, settings.getSettings);
  }
  const providers = yield* refreshSnapshot(input);
  return { providers: input.refreshModels ? yield* refreshModels(input, providers) : providers };
});

type SettingsInput = Parameters<
  ServerSettings.ServerSettingsService['Service']['updateSettings']
>[0];
type MutationInput = Parameters<
  ServerSettings.ServerSettingsService['Service']['updateProviderInstance']
>[0];

/** Adding, editing or removing an instance is a settings write (§6); clients get redacted settings. */
export const updateSettings = Effect.fnUntraced(function* (input: {
  readonly patch: SettingsInput;
  readonly providerInstanceMutation?: MutationInput;
}) {
  const settings = yield* ServerSettings.ServerSettingsService;
  const next =
    input.providerInstanceMutation === undefined
      ? yield* settings.updateSettings(input.patch)
      : yield* settings.updateProviderInstance(input.providerInstanceMutation, input.patch);
  return ServerSettings.redactServerSettingsForClient(next);
});

export const updateProvider = Effect.fnUntraced(function* (
  input: Parameters<ProviderMaintenanceRunner['Service']['updateProvider']>[0],
) {
  return yield* (yield* ProviderMaintenanceRunner).updateProvider(input);
});
