import { ServerProvider, ServerSettings, UsageLimitSourceSnapshot } from '@t3tools/contracts';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';

import { ProviderRegistry } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/provider/ProviderRegistry.ts';
import * as Settings from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/serverSettings.ts';
import { UsageLimitSources } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/usage/UsageLimitSources.ts';

const encodeProviders = Schema.encodeUnknownEffect(Schema.Array(ServerProvider));
const encodeSettings = Schema.encodeUnknownEffect(ServerSettings);
const encodeSources = Schema.encodeUnknownEffect(Schema.Array(UsageLimitSourceSnapshot));

/**
 * What the providers screen shows (T3's `server.getConfig` subset): every instance with status,
 * sign-in, models and usage limits, the redacted settings, and the usage-limit sources.
 */
export const readState = Effect.gen(function* () {
  const providers = yield* (yield* ProviderRegistry).getProviders;
  const settings = yield* (yield* Settings.ServerSettingsService).getSettings;
  const sources = yield* (yield* UsageLimitSources).current;
  return {
    providers: yield* encodeProviders(providers),
    settings: yield* encodeSettings(Settings.redactServerSettingsForClient(settings)),
    usageLimitSources: yield* encodeSources(sources),
  };
});

/** Live changes, as T3's `subscribeServerConfig` sends them: one tagged event per change. */
export const stateChanges = Effect.gen(function* () {
  const registry = yield* ProviderRegistry;
  const settings = yield* Settings.ServerSettingsService;
  const sources = yield* UsageLimitSources;
  const providers = registry.streamChanges.pipe(
    Stream.mapEffect((next) => encodeProviders(next)),
    Stream.map((payload) => ({ type: 'providerStatuses', payload: { providers: payload } })),
  );
  const settingsUpdates = settings.streamChanges.pipe(
    Stream.mapEffect((next) => encodeSettings(Settings.redactServerSettingsForClient(next))),
    Stream.map((payload) => ({ type: 'settingsUpdated', payload: { settings: payload } })),
  );
  const sourceUpdates = sources.streamChanges.pipe(
    Stream.mapEffect((next) => encodeSources(next)),
    Stream.map((payload) => ({ type: 'usageLimitSourcesUpdated', payload: { sources: payload } })),
  );
  return Stream.merge(providers, Stream.merge(settingsUpdates, sourceUpdates));
});
