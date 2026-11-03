// Excerpt (read-only reference) of every provider-related WebSocket RPC handler in T3 Code's apps/server/src/ws.ts.
// Each handler decodes input, calls ONE service method from the kit, and maps errors. Re-create these in your transport.

// ---- apps/server/src/ws.ts:2265-2270
        [WS_METHODS.serverGetConfig]: (_input) =>
          loadServerConfig({
            usageLimitsCommand: false,
            workspaceSnapshotsOnDemand: false,
            deferNetworkDiscovery: false,
          }),

// ---- apps/server/src/ws.ts:2271-2274
        [WS_METHODS.serverSearchAcpRegistry]: (input) =>
          acpRegistryCatalog
            .search(input)
            .pipe(Effect.mapError(AcpRegistrySupport.toAcpRegistryOperationError)),

// ---- apps/server/src/ws.ts:2275-2282
        [WS_METHODS.serverPrepareAcpRegistryAgent]: (input) =>
          Effect.annotateCurrentSpan({ "acp_registry.agent_id": input.agentId }).pipe(
            Effect.andThen(
              acpRegistryCatalog
                .prepare(input)
                .pipe(Effect.mapError(AcpRegistrySupport.toAcpRegistryOperationError)),
            ),
          ),

// ---- apps/server/src/ws.ts:2283-2290
        [WS_METHODS.serverUninstallAcpRegistryManagedBinary]: (input) =>
          Effect.annotateCurrentSpan({ "acp_registry.agent_id": input.agentId }).pipe(
            Effect.andThen(
              acpRegistryCatalog
                .uninstallManagedBinary(input)
                .pipe(Effect.mapError(AcpRegistrySupport.toAcpRegistryOperationError)),
            ),
          ),

// ---- apps/server/src/ws.ts:2291-2298
        [WS_METHODS.serverAcceptAcpRegistryUrlAuth]: (input) =>
          Effect.annotateCurrentSpan({ "provider.instance_id": input.instanceId }).pipe(
            Effect.andThen(
              acpRegistryRuntimeCoordinator
                .acceptUrlAuthentication(input)
                .pipe(Effect.map((accepted) => ({ accepted }))),
            ),
          ),

// ---- apps/server/src/ws.ts:2299-2303
        [WS_METHODS.serverListAcpRegistrySessions]: (input) =>
          Effect.annotateCurrentSpan({
            "provider.instance_id": input.instanceId,
            "project.id": input.projectId,
          }).pipe(Effect.andThen(listAcpRegistrySessions(input))),

// ---- apps/server/src/ws.ts:2304-2308
        [WS_METHODS.serverImportAcpRegistrySession]: (input) =>
          Effect.annotateCurrentSpan({
            "provider.instance_id": input.instanceId,
            "project.id": input.projectId,
          }).pipe(Effect.andThen(importAcpRegistrySession(input))),

// ---- apps/server/src/ws.ts:2309-2313
        [WS_METHODS.serverDeleteAcpRegistrySession]: (input) =>
          Effect.annotateCurrentSpan({
            "provider.instance_id": input.instanceId,
            "project.id": input.projectId,
          }).pipe(Effect.andThen(deleteAcpRegistrySession(input))),

// ---- apps/server/src/ws.ts:2314-2318
        [WS_METHODS.serverListAcpRegistryProviders]: (input) =>
          Effect.annotateCurrentSpan({
            "provider.instance_id": input.instanceId,
            "project.id": input.projectId,
          }).pipe(Effect.andThen(listAcpRegistryProviders(input))),

// ---- apps/server/src/ws.ts:2319-2323
        [WS_METHODS.serverSetAcpRegistryProvider]: (input) =>
          Effect.annotateCurrentSpan({
            "provider.instance_id": input.instanceId,
            "project.id": input.projectId,
          }).pipe(Effect.andThen(setAcpRegistryProvider(input))),

// ---- apps/server/src/ws.ts:2324-2328
        [WS_METHODS.serverDisableAcpRegistryProvider]: (input) =>
          Effect.annotateCurrentSpan({
            "provider.instance_id": input.instanceId,
            "project.id": input.projectId,
          }).pipe(Effect.andThen(disableAcpRegistryProvider(input))),

// ---- apps/server/src/ws.ts:2329-2369
        [WS_METHODS.serverLogoutAcpRegistry]: (input) =>
          Effect.annotateCurrentSpan({ "provider.instance_id": input.instanceId }).pipe(
            Effect.andThen(
              Effect.gen(function* () {
                const { instance, manager } = yield* acpSessionManager(input.instanceId);
                const snapshot = yield* instance.snapshot.getSnapshot;
                if (snapshot.auth.canLogout !== true) {
                  return yield* new AcpRegistryOperationError({
                    reason: "logout_unsupported",
                    message: "The ACP agent does not advertise logout.",
                  });
                }
                if (instance.auth) {
                  yield* providerAuth.logout(input).pipe(
                    Effect.mapError(
                      (cause) =>
                        new AcpRegistryOperationError({
                          reason: "logout_failed",
                          message: "Could not sign out of the ACP agent.",
                          cause,
                        }),
                    ),
                  );
                } else {
                  yield* providerSessionManager.closeInstance(input.instanceId).pipe(
                    Effect.mapError(
                      (cause) =>
                        new AcpRegistryOperationError({
                          reason: "logout_failed",
                          message: "Could not stop live sessions before ACP logout.",
                          cause,
                        }),
                    ),
                  );
                  yield* manager.logout(config.cwd);
                }
                yield* providerRegistry.refreshInstance(input.instanceId);
                return { loggedOut: true } as const;
              }),
            ),
          ),

// ---- apps/server/src/ws.ts:2370-2448
        [WS_METHODS.serverRefreshProviders]:
          /* Request instrumentation already owns the span; keep this helper in that context. */
          Effect.fnUntraced(function* (input) {
            if (input.refreshModels) {
              yield* providerRegistry.invalidateModelCaches({
                instanceId: input.instanceId,
                cwd: input.cwd,
                fresh: input.fresh,
              });
            }
            // Await refresh; RPC scope closure would interrupt a fork before the hub answered.
            if (input.instanceId === undefined) {
              yield* usageLimitSources.refresh;
            }
            if (input.reloadSecrets === true && input.instanceId === undefined) {
              yield* invalidateSettingsSecrets(secretResolver, serverSettings.getSettings);
            }
            let providers = yield* input.cwd !== undefined && input.instanceId !== undefined
              ? providerRegistry.refreshWorkspaceSnapshot({
                  instanceId: input.instanceId,
                  cwd: input.cwd,
                  fresh: input.fresh === true,
                })
              : input.reloadSecrets === true
                ? providerRegistry.reloadSecretsAndRefresh(input.instanceId)
                : input.instanceId !== undefined
                  ? providerRegistry.refreshInstance(input.instanceId)
                  : providerRegistry.refresh();
            if (input.refreshModels) {
              const instances = yield* providerInstances.listInstances;
              for (const instance of instances) {
                if (
                  !instance.refreshModels ||
                  (input.instanceId !== undefined && input.instanceId !== instance.instanceId) ||
                  !providers.some(
                    (provider) =>
                      provider.instanceId === instance.instanceId &&
                      provider.enabled &&
                      provider.installed,
                  )
                )
                  continue;
                yield* instance.refreshModels().pipe(
                  Effect.mapError(
                    (error) =>
                      new ProviderSetupError({
                        instanceId: instance.instanceId,
                        operation: "refresh-models",
                        detail: error.detail,
                      }),
                  ),
                );
                providers = yield* providerRegistry.refreshInstance(instance.instanceId);
              }
            }
            if (input.workspaceSnapshotsOnDemand !== true) return { providers };
            const commandProviders =
              input.usageLimitsCommand === true
                ? withUsageLimitsCommands(providers, yield* usageLimitSources.current)
                : providers;
            const { instanceId, cwd } = input;
            if (instanceId === undefined || cwd === undefined) {
              return { providers: withoutWorkspaceSnapshots(commandProviders) };
            }
            return {
              providers: commandProviders
                .filter((provider) => provider.instanceId === instanceId)
                .map((provider) => ({
                  ...provider,
                  // Callers read only the cwd snapshot; the config stream carries the rest.
                  models: [],
                  slashCommands: [],
                  skills: [],
                  workspaceSnapshots: (provider.workspaceSnapshots ?? []).filter(
                    (snapshot) => snapshot.cwd === cwd,
                  ),
                })),
            };
          }),

// ---- apps/server/src/ws.ts:2453-2500
        [WS_METHODS.providerUploadFeedback]:
          /* Request instrumentation already owns the span; keep this helper in that context. */
          Effect.fnUntraced(
            function* (input) {
              const projection = yield* threadManagement.getThreadRecords(input.threadId, [
                "providerThreads",
              ]);
              const providerThread =
                projection.providerThreads.find(
                  (candidate) => candidate.id === projection.thread.activeProviderThreadId,
                ) ?? projection.providerThreads.at(-1);
              const providerSessionId = providerThread?.providerSessionId ?? null;
              if (providerThread === undefined || providerSessionId === null) {
                return yield* new ProviderUploadFeedbackError({
                  threadId: input.threadId,
                  cause: "No provider session has run in this thread yet.",
                });
              }
              const runtime = Option.getOrNull(yield* providerSessionsV2.get(providerSessionId));
              if (runtime === null) {
                return yield* new ProviderUploadFeedbackError({
                  threadId: input.threadId,
                  cause: "The provider session is no longer running. Send a message first.",
                });
              }
              if (runtime.uploadFeedback === undefined) {
                return yield* new ProviderUploadFeedbackError({
                  threadId: input.threadId,
                  cause: `Provider '${runtime.driver}' does not support feedback uploads.`,
                });
              }
              return yield* runtime.uploadFeedback({
                providerThread,
                ...(input.reason === undefined ? {} : { reason: input.reason }),
              });
            },
            (effect, input) =>
              effect.pipe(
                Effect.mapError((cause) =>
                  isProviderUploadFeedbackError(cause)
                    ? cause
                    : new ProviderUploadFeedbackError({
                        threadId: input.threadId,
                        cause,
                      }),
                ),
              ),
          ),

// ---- apps/server/src/ws.ts:2501-2502
        [WS_METHODS.serverUpdateProvider]: (input) =>
          providerMaintenanceRunner.updateProvider(input),

// ---- apps/server/src/ws.ts:2503-2534
        [WS_METHODS.providerConsumeResetCredit]:
          /* Request instrumentation already owns the span; keep this helper in that context. */
          Effect.fnUntraced(function* (input) {
            if ("sourceId" in input) return yield* usageLimitSources.consumeResetCredit(input);
            const instance = yield* providerInstances.getInstance(input.instanceId);
            if (instance === undefined || !instance.enabled) {
              return yield* new ProviderSetupError({
                instanceId: input.instanceId,
                operation: "consume-reset-credit",
                detail: instance ? "This provider is disabled." : "Provider instance not found.",
              });
            }
            if (instance.consumeResetCredit === undefined) {
              return yield* new ProviderSetupError({
                instanceId: input.instanceId,
                operation: "consume-reset-credit",
                detail: "This provider does not bank reset credits.",
              });
            }
            const outcome = yield* instance.consumeResetCredit().pipe(
              Effect.mapError(
                (error) =>
                  new ProviderSetupError({
                    instanceId: input.instanceId,
                    operation: "consume-reset-credit",
                    detail: error.detail,
                    cause: error,
                  }),
              ),
            );
            return { outcome };
          }),

// ---- apps/server/src/ws.ts:2535-2535
        [WS_METHODS.providerAuthStart]: (input) => providerAuth.start(input, currentSessionId),

// ---- apps/server/src/ws.ts:2536-2539
        [WS_METHODS.providerAuthRespond]: (input) =>
          Effect.annotateCurrentSpan({ instanceId: input.instanceId }).pipe(
            Effect.andThen(providerAuth.respond(input, currentSessionId)),
          ),

// ---- apps/server/src/ws.ts:2540-2541
        [WS_METHODS.providerAuthComplete]: (input) =>
          providerAuth.complete(input, currentSessionId),

// ---- apps/server/src/ws.ts:2542-2542
        [WS_METHODS.chatGptReconnectProfile]: (input) => providerAuth.reconnectProfile(input),

// ---- apps/server/src/ws.ts:2543-2543
        [WS_METHODS.chatGptImportProfile]: (input) => providerAuth.importProfile(input),

// ---- apps/server/src/ws.ts:2544-2545
        [WS_METHODS.chatGptHandoffSubscribe]: (input) =>
          subscribeChatGptHandoff(input, currentSessionId),

// ---- apps/server/src/ws.ts:2546-2546
        [WS_METHODS.providerAuthCancel]: (input) => providerAuth.cancel(input, currentSessionId),

// ---- apps/server/src/ws.ts:2547-2547
        [WS_METHODS.providerAuthLogout]: (input) => providerAuth.logout(input),

// ---- apps/server/src/ws.ts:2548-2549
        [WS_METHODS.providerAuthSubscribe]: (input) =>
          providerAuth.subscribe(input, currentSessionId),

// ---- apps/server/src/ws.ts:2550-2550
        [WS_METHODS.providerInstallStart]: (input) => providerInstallation.start(input),

// ---- apps/server/src/ws.ts:2551-2551
        [WS_METHODS.providerInstallCancel]: (input) => providerInstallation.cancel(input),

// ---- apps/server/src/ws.ts:2552-2552
        [WS_METHODS.providerInstallSubscribe]: (input) => providerInstallation.subscribe(input),

// ---- apps/server/src/ws.ts:2553-2553
        [WS_METHODS.providerInstallRemove]: (input) => providerInstallation.remove(input),

// ---- apps/server/src/ws.ts:2582-2595
        [WS_METHODS.serverUpdateSettings]:
          /* Request instrumentation already owns the span; keep this helper in that context. */
          Effect.fnUntraced(function* ({ patch, providerInstanceMutation }) {
            const deviceHosts = patch.deviceHosts
              ? yield* remoteSshDeviceHosts(patch.deviceHosts).pipe(
                  Effect.provide(deviceHostContext),
                )
              : undefined;
            const nextPatch = { ...patch, ...(deviceHosts ? { deviceHosts } : {}) };
            const settings = yield* providerInstanceMutation === undefined
              ? serverSettings.updateSettings(nextPatch)
              : serverSettings.updateProviderInstance(providerInstanceMutation, nextPatch);
            return ServerSettings.redactServerSettingsForClient(settings);
          }),

// ---- apps/server/src/ws.ts:2608-2608
        [WS_METHODS.serverGetUsageSummary]: (input) => usage.readSummary(input),

// ---- apps/server/src/ws.ts:2609-2609
        [WS_METHODS.serverRefreshUsageRates]: (_input) => usage.refreshRates,

// ---- apps/server/src/ws.ts:3165-3292
        [WS_METHODS.subscribeServerConfig]: (input) =>
          Stream.unwrap(
            Effect.gen(function* () {
              const usageLimitsCommand = input.usageLimitsCommand === true;
              const workspaceSnapshotsOnDemand = input.workspaceSnapshotsOnDemand === true;
              // Buffer changes through discovery and the initial snapshot's RPC ACK wait.
              const keybindingsChanges = yield* keybindings.subscribeChanges;
              const settingsChanges = yield* serverSettings.subscribeChanges;
              const remoteTargets = yield* Effect.forkScoped(remoteOpenTargets.resolveTargets(), {
                startImmediately: true,
              });
              const directResult = yield* Effect.forkScoped(
                directEndpoints
                  .resolve()
                  .pipe(Effect.catchCause(() => directEndpoints.resolveAvailable())),
                { startImmediately: true },
              );
              const config = yield* loadServerConfig({
                usageLimitsCommand,
                workspaceSnapshotsOnDemand,
                deferNetworkDiscovery: true,
              });
              const keybindingsUpdates = keybindingsChanges.pipe(
                Stream.map((event) => ({
                  version: 1 as const,
                  type: "keybindingsUpdated" as const,
                  payload: {
                    keybindings: event.keybindings,
                    issues: event.issues,
                  },
                })),
              );
              const providerStatuses = Stream.zipLatestWith(
                // Seed the changes-only stream so early source refreshes pair with current providers.
                Stream.concat(
                  Stream.fromEffect(providerRegistry.getProviders),
                  providerRegistry.streamChanges,
                ),
                usageLimitSources.streamChanges.pipe(
                  Stream.changesWith(
                    usageLimitsCommand ? sameUsageLimitCommandCoverage : () => true,
                  ),
                ),
                (providers, sources) => {
                  const commandProviders = usageLimitsCommand
                    ? withUsageLimitsCommands(providers, sources)
                    : providers;
                  // Stripped before the de-dupe below, so snapshot-only changes send nothing.
                  return workspaceSnapshotsOnDemand
                    ? withoutWorkspaceSnapshots(commandProviders)
                    : commandProviders;
                },
              ).pipe(
                // Compare initial paired values with the snapshot; blindly dropping them loses changes between snapshot and subscription.
                (updates) => Stream.concat(rpcInitialItems([config.providers]), updates),
                Stream.changesWith(
                  (previous, next) => JSON.stringify(previous) === JSON.stringify(next),
                ),
                Stream.drop(1),
                Stream.map((providers) => ({
                  version: 1 as const,
                  type: "providerStatuses" as const,
                  payload: { providers },
                })),
                Stream.debounce(Duration.millis(PROVIDER_STATUS_DEBOUNCE_MS)),
              );
              // Gate capability-specific events; older clients reject them and lose their config subscription.
              const environmentThemeUpdates =
                input.environmentThemes === true
                  ? environmentTheme.streamChanges.pipe(
                      Stream.map((themes) => ({
                        version: 1 as const,
                        type: "environmentThemesUpdated" as const,
                        payload: { themes },
                      })),
                    )
                  : Stream.empty;
              const usageLimitSourceUpdates =
                input.usageLimitSources === true
                  ? usageLimitSources.streamChanges.pipe(
                      Stream.map((sources) => ({
                        version: 1 as const,
                        type: "usageLimitSourcesUpdated" as const,
                        payload: { sources },
                      })),
                    )
                  : Stream.empty;
              const settingsUpdates = settingsChanges.pipe(
                Stream.map((settings) => ServerSettings.redactServerSettingsForClient(settings)),
                Stream.map((settings) => ({
                  version: 1 as const,
                  type: "settingsUpdated" as const,
                  payload: { settings },
                })),
              );

              const liveUpdates = Stream.merge(
                keybindingsUpdates,
                Stream.merge(
                  providerStatuses,
                  Stream.merge(
                    settingsUpdates,
                    Stream.merge(environmentThemeUpdates, usageLimitSourceUpdates),
                  ),
                ),
              );

              const remoteResult = yield* Effect.sync(() => remoteTargets.pollUnsafe());
              const initialConfig =
                remoteResult?._tag === "Success"
                  ? { ...config, remoteOpenTargets: remoteResult.value }
                  : config;
              return Stream.concat(
                rpcInitialItems([
                  { version: 1 as const, type: "snapshot" as const, config: initialConfig },
                ]),
                withLateConfigDiscovery(
                  initialConfig,
                  liveUpdates,
                  externalLauncher,
                  {
                    resolveTargets: () => Fiber.join(remoteTargets),
                  },
                  { resolve: () => Fiber.join(directResult) },
                ),
              );
            }),
          ),
