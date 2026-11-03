# T3 AI Providers Kit: integration guide

This guide is written for the coding agent that will plant the kit in a host project. Read it fully before you copy anything.

The kit is the complete AI-provider, model and subscription system extracted from T3 Code (MIT, `pingdotgg/t3code`). It covers:

- every provider driver and adapter: Codex, Claude, Cursor, Grok, OpenCode 1.x/2.x, Antigravity, Kiro, Pi, Muse, fx, and the generic ACP Registry
- subscription sign-in: ChatGPT for Codex, Google for Antigravity, CLI logins, API-key fields
- model catalogs and the remote model manifest
- usage limits and reset credits
- the credential vault
- provider installs and updates
- admin policy
- text generation: commit messages, PR content, branch names, thread titles, review guides

All T3 Code source is copied byte-for-byte at its original relative path, so every import still resolves. The kit adds two kinds of files on top:

- **10 host-port stubs**, each marked `HOST PORT` (§4)
- **3 composition files** in `kit/apps/server/src/providerKit/`

Tests and the parts of T3 Code that are not about providers (threads, git, terminal, persistence, transport) are not included.

## 0. Verified facts (not claims)

The kit was checked as an isolated copy, on its own, with no T3 Code checkout next to it:

| Check | Result |
|---|---|
| Import graph from every kit file | 0 imports resolve outside `kit/` and 0 are unresolved. The only exception is `effect-codex-app-server/scripts/generate.ts`, a codegen script whose output file is generated. |
| `pnpm install` + `tsc --noEmit` on `apps/server` and all 27 packages | 0 errors, with the Effect language-service rules active |
| `node apps/server/src/providerKit/smoke.ts` (Node 24.18) | Boots the full stack and hydrates 10 provider instances. It loads the Claude catalog (13 models) from the bundled manifest. Status checks ran with an empty `HOME`, so every provider correctly reported `auth=unknown`. It then enables Cursor through `ServerSettingsService.updateProviderInstance`. The change persists to `settings.json`, and the registry reconciles it in about 100 ms. |

Not verified: a real sign-in, a real agent turn, and the web/mobile UI (§8), because the UI files are reference copies.

## 1. Folder map

```
t3-ai-providers-kit/
├─ kit/                      ← THE INSTALLABLE SYSTEM (pnpm workspace). Plant this.
│  ├─ apps/server/src/       ← provider server layer (T3 paths kept)
│  │  ├─ provider/           ← registry, hydration, auth service, credential store, Codex/Claude/Antigravity drivers, installs, updates, usage limits, model manifest
│  │  ├─ orchestration-v2/Adapters/ ← Codex/Claude/Antigravity turn adapters (ProviderAdapterV2)
│  │  ├─ orchestration-v2/ProviderAdapterRegistry.ts ← instanceId → live adapter
│  │  ├─ textGeneration/     ← commit/PR/branch/title/review generation with usage-aware fallback
│  │  ├─ usage/              ← UsageService (token/cost history), UsageLimitSources
│  │  ├─ secrets/, auth/ServerSecretStore.ts, settingsSecrets.ts ← credential vault + settings secret split
│  │  ├─ serverSettings.ts   ← settings.json service (providerInstances live here)
│  │  ├─ policy/managed*.ts  ← admin allow/deny of drivers, locked settings
│  │  ├─ providerKit/        ← ADDED: ProviderKitLayer.ts, ProviderKitStandalone.ts, smoke.ts
│  │  └─ (10 HOST PORT stubs, see §4)
│  ├─ packages/provider-core ← driver/adapter/auth/usage contracts + ProviderHost port + client registry types
│  ├─ packages/provider-*    ← one package per non-built-in driver (cursor, grok, fx, kiro, muse, opencode, pi, acp, acp-registry, testing)
│  ├─ packages/effect-acp, effect-codex-app-server ← typed protocol clients (ACP JSON-RPC, Codex app-server)
│  ├─ packages/contracts     ← ALL wire schemas (copied whole: it is a barrel)
│  ├─ packages/shared        ← subset: only modules the kit imports
│  ├─ packages/client-runtime← subset: browser/RN-safe provider registry, model traits, display helpers
│  ├─ packages/secret-provider-* ← external secret backends (1Password)
│  ├─ packages/source-control-* ← subset: browser-safe `shared/` halves only
│  ├─ pnpm-workspace.yaml, pnpm-lock.yaml, patches/ ← exact versions/patches T3 Code ships
│  └─ tsconfig.base.json
├─ host-reference/           ← the ORIGINAL T3 files behind each host-port stub (read, don't install)
├─ transport-reference/      ← ws.ts provider handlers excerpt + full ws.ts, rpc.ts, server.ts, runtimeLayer.ts
├─ ui-reference/             ← web (React), mobile (React Native), desktop (Electron) provider UI, path-preserved
├─ docs/                     ← T3's own provider internals + user guides (constraints, traps, per-provider notes)
├─ tools/closure.mjs         ← import-graph tracer used to build/verify the kit
└─ manifest.json / MANIFEST.md ← every file and its tier
```

## 2. Hard requirements of the host

1. **Node ≥ 24.10.** The source is `.ts` that runs directly through type stripping, with `import ... with { type: "json" }` and `node:sqlite`. Node 20 cannot run it. Node 22.16+ typechecks, but use 24+.
2. **Effect 4.1.2** (`effect`, `@effect/platform-node`). This is Effect 4 ("effect-smol"), not Effect 3. If the host already uses Effect 3, keep the kit in its own workspace package and talk to it through plain functions (§6). Do not mix the two versions in one module graph.
3. **pnpm workspace.** The packages reference each other as `workspace:*`. A host using npm or yarn can treat `kit/` as a nested pnpm workspace, or run it as a sidecar process (§6, option C).
4. **Keep `pnpm-workspace.yaml` overrides and patches as they are.** They pin `effect` to one copy (`@opencode/client` would otherwise pull in 4.0.1 and break types), pin `@anthropic-ai/sdk` to 0.93.0 (newer versions break Claude adapter types), and remove the Claude SDK's bundled binaries, since T3 always launches the user's own `claude`.
5. **TypeScript** is `@tsc-rs/typescript` (the drop-in T3 uses), and the tsconfig comes from `tsconfig.base.json`: `NodeNext`, `allowImportingTsExtensions`, `erasableSyntaxOnly` and `verbatimModuleSyntax`. Imports must keep their `.ts` extensions.
6. **Provider CLIs are the user's.** T3 never bundles agents. Each driver finds `claude`, `codex`, `cursor-agent`, `opencode`, `pi`, `grok`, `kiro-cli`, and so on, on the user's `PATH` or at a configured path. Codex and Antigravity can also be installed and managed by the kit itself (`CodexInstallation`, `AntigravityInstallation`).

## 3. Quick start (5 steps)

```bash
# 1. copy the installable folder into the host repo (any path)
cp -R t3-ai-providers-kit/kit  <host>/vendor/t3-ai-providers
# 2. install exactly what T3 ships
cd <host>/vendor/t3-ai-providers && pnpm install
# 3. prove it compiles in the host machine
pnpm run typecheck
# 4. prove it boots (uses an isolated home folder)
cd apps/server && KIT_HOME=$(mktemp -d) node src/providerKit/smoke.ts
# 5. wire it to the host (§5–§7)
```

Expect one log line per provider instance, for example `claudeAgent driver=claudeAgent status=ready auth=authenticated models=13` on a machine where `claude` is installed and signed in.

## 4. Host ports: the only seam you implement

The kit reaches outside itself in exactly 10 files. Each is a stub at the original path, with a header comment and the narrowest interface the kit actually uses. The full T3 implementation of each is in `host-reference/<same path>`. `ProviderKitStandalone.layerHostPorts` gives every port a working default, so the kit runs with no host code at all. Replace a default only when the host has that concept.

| Port (kit path under `apps/server/src/`) | Used by | Standalone default | Replace when |
|---|---|---|---|
| `environment/ServerEnvironment.ts` → `ServerEnvironmentIdentity` | Codex ChatGPT sign-in, managed token broker, handoff (binds tokens to this install) | `layerIdentityStatic(environmentId)` | Always pass a **persisted** UUID. A new id on every boot invalidates Codex managed sessions. |
| `orchestration-v2/ProviderSessionManager.ts` → `ProviderSessionManagerV2.release` | `ProviderAuthService`: a sign-in change stops sessions that used the old credentials | `layerNoop` | The host keeps live agent sessions (§7). |
| `orchestration-v2/ProjectionStore.ts` → `getRecoveryThreadIds`, `getThreadRecords(["providerSessions"])` | the same sign-in-change sweep | `layerEmpty` | The host stores threads and their provider sessions. |
| `orchestration-v2/ProjectStore.ts` → `listShells` | `ProjectSettingsOverrideSweep` (removes per-project provider overrides of deleted projects) | `layerEmpty` | The host has projects with per-project provider settings. |
| `policy/ManagedPolicy.ts` | `serverSettings.ts`: admin allow/deny of drivers, locked settings | `layerUnmanaged` | Enterprise/MDM policy. The original reads a machine policy file and the Windows registry. |
| `resourceTelemetry/DesktopTelemetryReceiver.ts` | `HostPowerMonitor` → `BackgroundPolicy`: pauses background model and usage refreshes on battery | `layerNone` | The host is an Electron or desktop shell that knows the power state. |
| `sourceControl/SourceControlProviderRegistry.ts` → `resolveLink` | thread-title generation: uses the PR/issue title when the prompt contains a GitHub/GitLab URL | `layerNone` | The host has source-control integration. |
| `sourceControl/sourceControlDefinitions.ts` | settings secret split for source-control host tokens | empty list | the same |
| `telemetry/AnalyticsService.ts` | Codex sign-in events (optional) and `ProviderUsageAnalytics` | `layerNoop` (exported, not wired by default) | The host has product analytics. Wire it only if you also compose `ProviderUsageAnalytics`. |
| `cloud/config.ts` | the `CLOUD_LINKED_USER_ID` constant, read by `telemetry/Identify.ts` | constant | never |

The host must also provide platform services, which the standalone layer already provides:

- `NodeServices.layer` and `NodeCrypto.layer` from `@effect/platform-node`
- `FetchHttpClient.layer` from `effect/http`
- `ServerConfig` (`config.ts`, which holds paths). Build it with `ServerConfig.layerTest(cwd, baseDir)` or `ServerConfig.layer({...})`.
- an `SqlClient`. The standalone layer opens `<baseDir>/userdata/providers.sqlite` with `@t3tools/shared/nodeSqliteClient`.

> **Trap: `serverSettings.ts` runs a one-time legacy migration.** It runs SQL against `projection_thread_sessions`, `provider_session_runtime` and `projection_projects`. On a fresh database those tables do not exist, and settings fail to load. `ProviderKitStandalone.ensureLegacySettingsTables` creates them empty. If you give the kit your own `SqlClient`, run that exported effect against it first.

## 5. Booting the system

```ts
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ProviderKit from "<kit>/apps/server/src/providerKit/ProviderKitStandalone.ts";

const ProviderSystem = ProviderKit.layer({
  cwd: process.cwd(),
  baseDir: "/path/to/app-data/ai",          // settings.json, secrets/, caches/, logs/ live here
  environmentId: persistedUuid as EnvironmentId,
});
// Run your program inside it. ServerSettingsService.start begins watching settings.json (T3 calls it at startup).
```

`ProviderKitLayer.layer` (no host ports) and `ProviderKitStandalone.layer` reproduce T3's own composition order from `transport-reference/apps/server/src/server.ts` (`layerRuntimeCoreDependencies`, `layerUsage`) and `orchestration-v2/runtimeLayer.ts`. Compiler-checked results:

- **Outputs:**
  - `ProviderRegistry`
  - `ProviderInstanceRegistry` and `ProviderInstanceRegistryMutator`
  - `ProviderAdapterRegistryV2`
  - `ProviderAuthService`
  - `TextGeneration`
  - `UsageService` and `UsageLimitSources`
  - `ProviderMaintenanceRunner`
  - `ModelManifest` and `ModelCatalog`
  - `ResetCreditCoordinator`
  - `CodexManagedTokenBroker`
  - `CodexInstallation` and `AntigravityInstallation`
  - `AcpRegistryCatalog`
  - `SecretResolver` and `ServerSecretStore`
  - `ServerSettingsService`
  - `BackgroundPolicy`
  - `McpProviderSessions`
  - `ProviderEventLoggers`
  - `OpenCodeRuntime`
  - `PortDiscovery`
- **Remaining requirements:** none, for `ProviderKitStandalone.layer`.
- **Startup errors:** `PlatformError | SecretStoreSecureError | SqlError`.

Do not reorder the layers casually. Provider hydration builds the Claude runner, which reports to `PortDiscovery`. Settings must exist before the registry is built.

## 6. Exposing it to clients (transport)

T3 keeps transports thin: a handler decodes input, calls **one** service method and maps errors. `transport-reference/ws-provider-handlers.excerpt.ts` contains every provider handler from T3's `ws.ts`, each with its original line numbers. The method names and schemas are in `packages/contracts/src/rpc.ts` (`WS_METHODS`).

| Wire method (contracts) | Service call |
|---|---|
| `subscribeServerConfig` / `server.getConfig` | `ProviderRegistry.getProviders` + `streamChanges` (each `ServerProvider` carries status, auth, **models**, usageLimits), zipped with `UsageLimitSources.streamChanges` |
| `server.refreshProviders` | `ProviderRegistry.refresh` / `refreshInstance` / `invalidateModelCaches` / `reloadSecretsAndRefresh` / `refreshWorkspaceSnapshot`, and `instance.refreshModels()` |
| `server.updateSettings` `{patch, providerInstanceMutation}` | `ServerSettingsService.updateSettings` / `updateProviderInstance`. Adding, editing or removing an instance is a settings write, and the hydration watcher reconciles the registry. |
| `provider.auth.start` / `.respond` / `.complete` / `.cancel` / `.logout` / `.subscribe` | `ProviderAuthService.start(input, ownerSessionId)`, and so on. `ownerSessionId` is the client's auth session: a sign-in flow belongs to the client that started it. |
| `provider.chatgpt.reconnect-profile` / `import-profile` / `handoff.subscribe` | `ProviderAuthService.reconnectProfile` / `importProfile`, and `CodexChatGptHandoff` |
| `provider.install.start` / `.cancel` / `.subscribe` / `.remove` | `provider/providerInstallation.ts` (`makeProviderInstallation`) |
| `server.updateProvider` | `ProviderMaintenanceRunner.updateProvider` |
| `provider.consumeResetCredit` | `instance.consumeResetCredit()` or `UsageLimitSources.consumeResetCredit` |
| `server.getUsageSummary` / `server.refreshUsageRates` | `UsageService` |
| `server.searchAcpRegistry`, `prepareAcpRegistryAgent`, `acceptAcpRegistryUrlAuth`, `list/import/deleteAcpRegistrySession(s)`, `list/set/disableAcpRegistryProvider(s)`, `logoutAcpRegistry`, `uninstallAcpRegistryManagedBinary` | `AcpRegistryCatalog` and `instance.acpSessionManagement` |

Three ways to expose these, smallest first:

- **A.** Same Effect process. Call the services directly from your Effect routes.
- **B.** Your own transport (REST, tRPC, Socket.IO). Write one handler per row and decode inputs with the contracts schemas.
- **C.** Sidecar process. Boot the kit with Effect's `RpcServer` over `WS_METHODS`, the way T3 does (see `ws.ts`), and call it from any language.

**Remote rule.** T3 clients reach environments locally, over the LAN, over Tailscale, or through a tunnel. Never bake a server origin into a client bundle. OAuth callbacks may land on a different machine from the server (§7.1).

## 7. Subscriptions, sign-in and turns

### 7.1 Sign-in flows (`ProviderAuthController` in `provider-core/src/server/auth.ts`)

- **Codex: ChatGPT subscription** (`provider/CodexChatGptAuth.ts`, `CodexManagedRuntime.ts`, `CodexManagedTokenBroker.ts`, `CodexAuthCallbackPage.ts`).
  - OAuth with PKCE, using a one-shot `node:http` loopback on `http://127.0.0.1:<port>/auth/callback`.
  - In "client" callback mode, the browser that finished login sends the callback URL back through `provider.auth.complete`. Use this when the server is remote.
  - `CodexChatGptHandoff.ts` lets a local primary finish sign-in for a remote environment. It uses an ephemeral store and transfers tokens, and only the destination keeps refreshing them.
  - Tokens are stored per credential binding through `ProviderCredentialStore` → `ServerSecretStore`, as `<stateDir>/secrets/provider-auth-<sha256>.bin` with mode 0700.
  - Instances with the same binding share one account.
- **Antigravity: Google account** (`AntigravityAuth.ts`, `antigravityCallback.ts`, `antigravityAuthSupport.ts`).
  - The native process owns the token exchange. T3 only forwards the loopback callback of the flow that the initiating session owns.
  - Each instance gets an isolated profile with file-based credentials, and ambient Google credentials are stripped.
  - Signing out stops new processes and kills running ones before clearing metadata.
- **Claude** has no T3 auth controller. It relies on the user's `claude` CLI login. Auth is only probed, and subscription usage limits are read in `claudeUsageLimits.ts`.
- **Cursor, Kiro and similar:** API keys are sensitive `environment` fields in the driver's client definition (`CURSOR_API_KEY`, `KIRO_API_KEY`). `settingsSecrets.ts` moves them out of `settings.json` into the secret store and redacts them for clients.
- **ACP Registry agents** use `acceptAcpRegistryUrlAuth` and `logoutAcpRegistry`.
- **Prompt commands:** `ProviderAuthService.tryHandlePromptCommand` lets `/login`-style text in the composer start a flow.

### 7.2 Running agent turns

The kit ships the turn adapters for every provider, but a real turn has **not** been run through the kit. **Session ownership is the host's job.** In T3 that is orchestration (`ProviderSessionManager`, `RunExecutionService`, an event-sourced store), which is not in the kit. The originals are in `host-reference/` and `transport-reference/`. The minimal loop is shown below as **pseudocode, not compiled**:

```ts
const adapters = yield* ProviderAdapterRegistryV2;
const adapter = yield* adapters.get(modelSelection.instanceId);          // ProviderAdapterV2
const session = yield* adapter.openSession({ threadId, providerSessionId, modelSelection, runtimePolicy }); // needs a Scope
const providerThread = yield* session.ensureThread({ threadId, modelSelection, runtimePolicy });
yield* session.events.pipe(Stream.runForEach(handleEvent), Effect.forkScoped); // ProviderAdapterV2Event union
yield* session.startTurn({
  appThread, threadId, runId, runOrdinal, providerTurnOrdinal, attemptId, rootNodeId, // host-minted ids
  providerThread, message, modelSelection, runtimePolicy,
});
// approvals/questions: session.respondToRuntimeRequest; stop: session.interruptTurn; steer: session.steerTurn
```

`ProviderAdapterV2TurnInput` requires orchestration identities that the host mints:

- `appThread` (`OrchestrationV2AppThread`)
- `runId`
- `runOrdinal`
- `providerTurnOrdinal`
- `attemptId`
- `rootNodeId`

Their schemas are in `contracts/src/orchestrationV2.ts`. T3 creates them in `apps/server/src/orchestration-v2/ProviderTurnStartService.ts` and `RunExecutionService.ts`. Those two files are in the T3 Code repository and are not in this kit. `runtimePolicy` is `ProviderAdapterV2RuntimePolicy`.

Contract: `packages/provider-core/src/server/ProviderAdapter.ts` (`ProviderAdapterV2SessionRuntime`, `ProviderAdapterV2Event`). Read `docs/internals/providers.md` and `docs/internals/adding-a-provider.md` before you write the session owner. They list the traps every adapter hit, including:

- stop sent before the turn started
- "default" model is a sentinel
- background work outliving a turn
- usage limits are `usage_limit`, not generic failures

When you implement it, replace the `ProviderSessionManager` and `ProjectionStore` stubs with your real owner, so that sign-in changes stop the right sessions.

### 7.3 Models and capabilities

- `provider/model-manifest.json` is the bundled manifest, and `ModelManifest.ts` refreshes it from T3's `main` branch. A newer bundle beats the cached copy by `updatedAt`, so bump it when you edit the file.
- Claude's whole catalog comes from the manifest. Codex lists models through its app server, plus `minVersion` entries that tell the user to update.
- Clients read `ServerProvider.models`, `updateRequiredModels`, and option descriptors (`contracts/src/model.ts`).
- Capability flags in `OrchestrationV2ProviderCapabilities` must describe what the provider really does. See `docs/orchestration-v2/provider-capability-system.md`.

### 7.4 Usage, limits and text generation

- Usage-limit windows are part of each instance snapshot (`provider-core/src/server/usageLimits.ts`), cached at `<baseDir>/caches/<instanceId>.json`.
- `UsageService` aggregates token and cost history from each driver's usage reader (`BUILT_IN_USAGE_DRIVERS` order matters).
- `TextGeneration` picks the selected instance's `textGeneration`. If that instance's usage window is exhausted, it falls back to another enabled, signed-in instance.

## 8. Client side

- **Drop-in (in `kit/`):** `packages/client-runtime/src/providerClients.ts` is the one client registry of all 11 driver definitions (label, settings schema, icon data, badge). Each `packages/provider-*/src/client.ts` and `settings.ts` is browser- and React Native-safe. Also drop-in: `modelTraits.ts` (reasoning/effort controls), `providerUpdateRequiredModels.ts`, `state/providerInstanceDisplay.ts`, `state/usageProgress.ts`, and the shared helpers `@t3tools/shared/model`, `serverSettings`, `usageLimits`, `usageFormat`, `codexAuthCallback`, `providerAuthReturnUrl`, and so on.
- **Reference only (`ui-reference/`):**
  - These files depend on T3's client runtime: Effect atoms, an environment connection supervisor and a router.
  - Port them to the host UI and keep the behavior, not the plumbing.
  - `packages/client-runtime/src/state/server.ts` shows every provider command as `createEnvironmentRpcCommand`.
- **Web screens:**
  - Settings → Providers: `ProviderSettingsPanel`, `ProviderInstanceCard`, `AddProviderInstanceDialog` and its wizard
  - Sign-in: `ProviderAuthenticationSection`, `CodexSetupSection`, `ChatGpt*`
  - Model picker: `ProviderModelPicker`, `TraitsPicker`, `ComposerModelEffort`
  - Usage and limits: `components/usage/*`, `ComposerUsageLimits`, `UsageLimitRecoveryBanner`
  - Updates: `ProviderUpdatesAction`
  - Onboarding: `WelcomeWizard` agents step
- **Mobile:** `features/settings/SettingsProviderAccountsRouteScreen.tsx`, `ComposerModelControl`, `features/usage/*`, and the subscription home-screen widget (`widgets/*SubscriptionUsage*` and `modules/t3-subscription-widget`).
- **Desktop (Electron):** `ipc/methods/providerAuth.ts` opens the system browser and waits on the loopback callback. `app/DesktopClerk.ts` handles the hosted-web → desktop ChatGPT handoff and deep-link return.
- Icons: Codex, Claude and Antigravity use hard-coded icons in web `components/Icons.tsx`. Every other provider ships plain-data SVG in its client definition.

When you port the UI, cover every surface: the settings page, the command palette ("refresh providers", "open usage"), the composer picker, onboarding, and mobile. Add the way out for each way in: sign-in needs sign-out, install needs remove, enable needs disable.

## 9. Adding or removing providers

- **Remove a driver:** delete its entry from `BUILT_IN_DRIVERS` and `BUILT_IN_USAGE_DRIVERS` in `provider/builtInDrivers.ts` and from `providerClients.ts`. The package can stay or go.
- **Add a driver:** follow `docs/internals/adding-a-provider.md`. Model it on a `packages/provider-<name>` package (Pi is the reference), with `./settings`, `./client` and `./server`. Register it in `builtInDrivers.ts`, `providerStatusCache.ts` order, `model-manifest.json` (bump `updatedAt`), and `providerClients.ts`. ACP agents need no code: use the ACP Registry driver.

## 10. Rules the system depends on (do not "simplify" these away)

- Route all work by **instance**, never by driver kind. Two accounts on one driver must not share sessions, catalogs or credentials.
- Status checks must never open a session that can start MCP servers, run hooks or open a login browser. Heavier probes run only on explicit refresh.
- Run an update only through the installer that provably owns the binary (`providerMaintenanceRunner.ts`); otherwise leave it manual.
- Strip ambient credentials the instance did not configure (`provider-core/src/server/instanceEnvironment.ts`).
- Report unknown sign-in state as unknown, not as signed in.
- Keep `contracts` as the single wire truth. Change the schema there and every surface follows.

## 11. Planting checklist

- [ ] `kit/` copied, `pnpm install` ran with the shipped lockfile, overrides and patches
- [ ] `pnpm run typecheck` shows 0 errors
- [ ] `smoke.ts` prints every instance on the target machine
- [ ] Persisted `environmentId` and `baseDir` chosen (not the user's T3 Code `~/.t3`)
- [ ] Each host port decided: default kept, or replaced with the host implementation
- [ ] Transport rows from §6 exposed, with sign-in flows owned by the initiating client session
- [ ] Remote callback path works when the server is not on the user's machine (§7.1)
- [ ] UI ported for settings, sign-in, model picker, usage, updates and onboarding on every client surface
- [ ] Session owner implemented if turns are needed (§7.2), and the stub ports replaced
