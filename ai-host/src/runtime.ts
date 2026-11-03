import type { EnvironmentId } from '@t3tools/contracts';
import * as Effect from 'effect/Effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';

import * as ServerSettings from '../../vendor/t3-ai-providers-kit/kit/apps/server/src/serverSettings.ts';
import * as ProviderKit from '../../vendor/t3-ai-providers-kit/kit/apps/server/src/providerKit/ProviderKitStandalone.ts';
import type { HostConfig } from './config.ts';
import { persistedEnvironmentId } from './environment-id.ts';

/** The whole provider system, built once with T3's own composition (ProviderKitStandalone). */
export function makeKitRuntime(config: HostConfig) {
  return ManagedRuntime.make(
    ProviderKit.layer({
      cwd: config.cwd,
      baseDir: config.home,
      environmentId: persistedEnvironmentId(config.home) as EnvironmentId,
    }),
  );
}

export type KitRuntime = ReturnType<typeof makeKitRuntime>;

/** T3 starts the settings watcher at boot; edits to settings.json then reach the registry. */
export const startSettingsWatcher = Effect.gen(function* () {
  const settings = yield* ServerSettings.ServerSettingsService;
  yield* settings.start;
});
