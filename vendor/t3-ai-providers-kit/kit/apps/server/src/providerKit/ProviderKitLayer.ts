/**
 * ProviderKitLayer - the whole AI provider system as one Effect Layer, composed in the same order
 * as T3 Code's apps/server/src/server.ts (layerRuntimeCoreDependencies + layerUsage + runtimeLayer).
 *
 * Added by t3-ai-providers-kit; it is the only kit file that is not a byte-for-byte T3 Code copy
 * besides the host-port stubs. Read INTEGRATION_GUIDE.md before changing the order.
 *
 * @module ProviderKitLayer
 */
import * as AcpRegistrySupport from "@t3tools/provider-acp-registry/server/AcpRegistrySupport";
import * as McpProviderSessions from "@t3tools/provider-core/server/McpProviderSessions";
import * as ProviderEventLoggers from "@t3tools/provider-core/server/ProviderEventLoggers";
import * as ProviderLatestVersions from "@t3tools/provider-core/server/ProviderLatestVersions";
import * as CursorAccountReader from "@t3tools/provider-cursor/server/CursorAccountReader";
import * as CursorKeychain from "@t3tools/provider-cursor/server/CursorKeychain";
import * as CursorUsageAccounts from "@t3tools/provider-cursor/server/CursorUsageAccounts";
import { MuseUsageHome } from "@t3tools/provider-muse/server";
import * as OpenCodeRuntime from "@t3tools/provider-opencode/server/OpenCodeRuntime";
import * as OpenCodeServerLedger from "@t3tools/provider-opencode/server/OpenCodeServerLedger";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as BackgroundPolicy from "../background/BackgroundPolicy.ts";
import * as HostPowerMonitor from "../background/HostPowerMonitor.ts";
import * as ServerConfig from "../config.ts";
import * as ProviderAdapterRegistry from "../orchestration-v2/ProviderAdapterRegistry.ts";
import * as PortScanner from "../preview/PortScanner.ts";
import * as ProcessRunner from "../processRunner.ts";
import * as AntigravityInstallation from "../provider/AntigravityInstallation.ts";
import * as CodexInstallation from "../provider/CodexInstallation.ts";
import * as CodexManagedTokenBroker from "../provider/CodexManagedTokenBroker.ts";
import * as AntigravityUsage from "../provider/Drivers/AntigravityUsage.ts";
import * as EventNdjsonLogger from "../provider/EventNdjsonLogger.ts";
import * as ModelManifest from "../provider/ModelManifest.ts";
import * as ProjectSettingsOverrideSweep from "../provider/ProjectSettingsOverrideSweep.ts";
import * as ProviderAuthService from "../provider/ProviderAuthService.ts";
import * as ProviderHostLive from "../provider/ProviderHostLive.ts";
import * as ProviderInstanceRegistryHydration from "../provider/ProviderInstanceRegistryHydration.ts";
import * as ProviderMaintenanceRunner from "../provider/providerMaintenanceRunner.ts";
import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as ResetCreditCoordinator from "../provider/resetCreditCoordinator.ts";
import * as ResourceAttribution from "../resourceTelemetry/ResourceAttribution.ts";
import * as SecretResolver from "../secrets/SecretResolver.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as TextGeneration from "../textGeneration/TextGeneration.ts";
import * as CodexUsageHistory from "../usage/CodexUsageHistory.ts";
import * as UsageLimitSources from "../usage/UsageLimitSources.ts";
import * as UsageService from "../usage/UsageService.ts";

const layerSecretStore = ServerSecretStore.layer;

/** settings.json + secret split. Host provides ManagedPolicy and an SqlClient (see guide §4). */
const layerServerSettings = ServerSettings.layer.pipe(Layer.provide(layerSecretStore));

const layerBackground = BackgroundPolicy.layer.pipe(
  Layer.provide(HostPowerMonitor.layer),
  Layer.provideMerge(layerServerSettings),
);

const layerProviderHost = ProviderHostLive.layer.pipe(Layer.provide(layerSecretStore));

// Share rotation state so driver loggers cannot race (server.ts layerProviderEventLoggers).
const layerProviderEventLoggers = Layer.effect(
  ProviderEventLoggers.ProviderEventLoggers,
  Effect.gen(function* () {
    const { providerEventLogPath } = yield* ServerConfig.ServerConfig;
    const attribution = yield* ResourceAttribution.ResourceAttribution;
    const store = yield* EventNdjsonLogger.makeEventNdjsonLogStore(providerEventLogPath, {
      attribution,
    }).pipe(
      Effect.catch((error) =>
        Effect.logWarning(error.message, { error }).pipe(
          Effect.annotateLogs({ scope: "provider-observability" }),
          Effect.as(undefined),
        ),
      ),
    );
    if (!store) return ProviderEventLoggers.NoOpProviderEventLoggers;
    yield* Effect.addFinalizer(() => store.close());
    return { native: store.logger("native"), canonical: store.logger("canonical") };
  }),
).pipe(Layer.provide(ResourceAttribution.layer));

const layerUsage = UsageService.layer.pipe(
  Layer.provide(
    Layer.mergeAll(
      AntigravityUsage.layer,
      MuseUsageHome.layer,
      CodexUsageHistory.layer,
      CursorUsageAccounts.layer.pipe(
        Layer.provide(CursorAccountReader.layer.pipe(Layer.provide(CursorKeychain.layer))),
      ),
    ).pipe(Layer.provide(layerProviderHost)),
  ),
);

/** Registry of live provider instances, status snapshots, model catalogs, sign-in, usage. */
const layerProviderCore = Layer.mergeAll(
  ProviderAuthService.layer,
  TextGeneration.layer,
  ProviderAdapterRegistry.layerFromProviderInstanceRegistry,
  ProviderMaintenanceRunner.layer,
  Layer.effectDiscard(ProjectSettingsOverrideSweep.sweep),
).pipe(
  Layer.provideMerge(UsageLimitSources.layer),
  Layer.provideMerge(ProviderRegistry.layer),
  Layer.provideMerge(ProviderInstanceRegistryHydration.layer),
  // Provider hydration builds the Claude runner, which reports agents to the port scanner.
  Layer.provideMerge(PortScanner.layer.pipe(Layer.provide(ProcessRunner.layer))),
  Layer.provideMerge(
    Layer.mergeAll(
      AntigravityInstallation.AntigravityInstallation.layer,
      CodexInstallation.CodexInstallation.layer,
    ),
  ),
  Layer.provideMerge(SecretResolver.layer),
  Layer.provideMerge(AcpRegistrySupport.layerFromHost.pipe(Layer.provide(layerProviderHost))),
  Layer.provideMerge(
    Layer.mergeAll(
      layerProviderEventLoggers,
      ModelManifest.layerModelCatalog.pipe(Layer.provideMerge(ModelManifest.layer)),
      ResetCreditCoordinator.layer,
      ProviderLatestVersions.layer,
      McpProviderSessions.layer,
    ),
  ),
  Layer.provideMerge(
    OpenCodeRuntime.layer.pipe(
      Layer.provide(
        Layer.unwrap(
          Effect.gen(function* () {
            const config = yield* ServerConfig.ServerConfig;
            return OpenCodeServerLedger.layer({ stateDir: config.stateDir });
          }),
        ),
      ),
    ),
  ),
  Layer.provideMerge(CodexManagedTokenBroker.layer),
  Layer.provideMerge(layerSecretStore),
);

export const layer = layerProviderCore.pipe(
  Layer.provideMerge(layerUsage),
  Layer.provideMerge(layerBackground),
);
