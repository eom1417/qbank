# Manifest

Generated from `manifest.json`. Paths are relative to `kit/` (installable) or to the named reference folder.

## Tier 1: installable kit (`kit/`): 567 files, byte-identical to T3 Code

- **apps/server/** (1): package.json
- **apps/server/scripts/** (1): dev-replay-agent.ts
- **apps/server/src/** (12): attachmentPaths.ts, attachmentStore.ts, claude-history-worker.ts, claudeHistoryWorker.ts, claudeModelOptions.ts, codexModelOptions.ts, config.ts, imageMime.ts, processRunner.ts, serverSettings.ts, settingsSecrets.ts, zipArchive.ts
- **apps/server/src/auth/** (1): ServerSecretStore.ts
- **apps/server/src/background/** (2): BackgroundPolicy.ts, HostPowerMonitor.ts
- **apps/server/src/mcpApps/** (1): McpAppSnapshot.ts
- **apps/server/src/orchestration-v2/** (5): ProviderAdapterRegistry.ts, unknownField.ts, workflowAgentAnswers.ts, workflowAgentTranscript.ts, workflowFileRead.ts
- **apps/server/src/orchestration-v2/Adapters/** (6): AntigravityAdapterV2.ts, ClaudeAdapterV2.ts, ClaudeTaskOutputTail.ts, CodexAdapterV2.ts, ProviderTextDeltaCoalescer.ts, claudeWorkflowProgress.ts
- **apps/server/src/policy/** (2): managedProviders.ts, managedSettings.ts
- **apps/server/src/preview/** (1): PortScanner.ts
- **apps/server/src/project/** (1): AgentSessionJson.ts
- **apps/server/src/provider/** (60): AntigravityAuth.ts, AntigravityInstallation.ts, AntigravityProvider.ts, ClaudeModelCatalog.ts, ClaudeModelManifest.ts, ClaudeProvider.ts, ClaudeTurnTokenUsage.ts, CodexAuthCallbackPage.ts, CodexChatGptAuth.ts, CodexChatGptHandoff.ts, CodexChatGptModels.ts, CodexChatGptSessionLock.ts, CodexDeveloperInstructions.ts, CodexInstallation.ts, CodexManagedErrors.ts, CodexManagedHome.ts, CodexManagedRuntime.ts, CodexManagedTokenBroker.ts, CodexManagedTokenProtocol.ts, CodexMcpElicitation.ts, CodexProvider.ts, CodexThreadRevert.ts, CodexToolPresentation.ts, CodexTurnTokenUsage.ts, DocumentText.ts, Errors.ts, EventNdjsonLogger.ts, ModelManifest.ts, ProjectSettingsOverrideSweep.ts, ProviderAuthService.ts, ProviderCredentialStore.ts, ProviderHostLive.ts, ProviderInstanceRegistry.ts, ProviderInstanceRegistryHydration.ts, ProviderInstanceRegistryMutator.ts, ProviderOrchestrationAdapterInfrastructure.ts, ProviderRegistry.ts, ProviderUsageLimitsIngestion.ts, agentContextBudget.json, antigravityAuthSupport.ts, antigravityCallback.ts, antigravityRelease.ts, antigravityUsageLimits.ts, builtInDrivers.ts, builtInProviderCatalog.ts, claudeResetCredits.ts, claudeUsageLimits.ts, codexLaunchArgs.ts, codexModelCatalog.ts, codexUsageLimits.ts, documentTextWorker.ts, model-manifest.json, providerCompatibility.ts, providerInstallation.ts, providerMaintenanceCommandCoordinator.ts, providerMaintenanceRunner.ts, providerStatusCache.ts, resetCreditCoordinator.ts, unavailableProviderSnapshot.ts, userInputAttachments.ts
- **apps/server/src/provider/Drivers/** (15): AntigravityDriver.ts, AntigravitySkills.ts, AntigravityUsage.ts, ClaudeDriver.ts, ClaudeExecutable.ts, ClaudeHome.ts, ClaudeMaintenance.ts, ClaudeSkillDispatch.ts, ClaudeSkills.ts, CodexDriver.ts, CodexHomeLayout.ts, CodexManagedProvider.ts, antigravityUsageReader.ts, claudeUsage.ts, codexUsage.ts
- **apps/server/src/provider/acp/** (8): AntigravityAcpSupport.ts, AntigravityChildWork.ts, AntigravityClientFiles.ts, AntigravityEditLocation.ts, AntigravityProfilePaths.ts, AntigravityProtocol.ts, AntigravitySessionFiles.ts, AntigravityTurnOutcome.ts
- **apps/server/src/provider/testUtils/** (1): providerRegistryMock.ts
- **apps/server/src/provider/testing/** (1): ProviderInstanceRegistryLive.fixture.mjs
- **apps/server/src/resourceTelemetry/** (1): ResourceAttribution.ts
- **apps/server/src/secrets/** (3): SecretResolver.ts, secretProviderDefinitions.ts, settingsSecretValue.ts
- **apps/server/src/sourceControl/** (1): sourceControlHostSecrets.ts
- **apps/server/src/telemetry/** (3): Identify.ts, ProviderDimensions.ts, ProviderUsageAnalytics.ts
- **apps/server/src/textGeneration/** (6): AntigravityTextGeneration.ts, ClaudeTextGeneration.ts, CodexTextGeneration.ts, TextGeneration.ts, TextGenerationPresets.ts, ThreadTitleLinks.ts
- **apps/server/src/textGeneration/testing/** (1): ClaudeTextGeneration.fixture.mjs
- **apps/server/src/usage/** (9): CodexUsageHistory.ts, UsageLimitSources.ts, UsageService.ts, cliproxyApi.ts, usageAggregation.ts, usagePricing.ts, usageScanCache.ts, usageTestFormats.ts, usageTranscriptReader.ts
- **packages/client-runtime/src/** (12): modelTraits.ts, providerClients.ts, providerUpdateRequiredModels.ts, sourceControlClients.ts, state/models.ts, state/providerInstanceDisplay.ts, state/subagentDisplay.ts, state/subagentRuntime.ts, state/threadExecution.ts, state/usageProgress.ts, threadPullRequests.ts, work-log/commandLabel.ts
- **packages/contracts/** (2): package.json, tsconfig.json
- **packages/contracts/src/** (77): acpRegistry.ts, agentSessions.ts, applicationEvent.ts, assets.ts, assistantCitations.ts, auth.ts, background.ts, baseSchemas.ts, browserImport.ts, browserProfile.ts, chatAttachment.ts, checkpointDiff.ts, clientRpcPermissions.ts, composerContext.ts, composerContextClipboard.ts, desktopAppActivation.ts, desktopBootstrap.ts, desktopBrowser.ts, device.ts, editor.ts, environment.ts, environmentHttp.ts, filesystem.ts, git.ts, guestShare.ts, guestStream.ts, index.ts, ipc.ts, keybindings.ts, managedPolicy.ts, mcpApps.ts, model.ts, modelSelection.ts, orchestrationDispatch.ts, orchestrationProject.ts, orchestrationV2.ts, orchestrationV2IdTable.ts, orchestratorMcp.ts, peerLink.ts, preview.ts, previewAutomation.ts, previewCapture.ts, project.ts, projectClone.ts, provider.ts, providerInstance.ts, providerPolicy.ts, providerRuntime.ts, providerSetup.ts, providerUsageLimits.ts, pullRequest.ts, pullRequestReviewGuide.ts, relay.ts, relayClient.ts, remoteAccess.ts, resourceTelemetry.ts, review.ts, rpc.ts, scheduledTask.ts, secretReference.ts, secretRequest.ts, server.ts, settings.ts, settingsSecretValue.ts, sourceControl.ts, t3ProjectFile.ts, terminal.ts, threadMetadataMcp.ts, threadPullRequest.ts, threadSearch.ts, threadTags.ts, threadTitle.ts, usage.ts, usageLimitSourceId.ts, vcs.ts, worktreeMcp.ts, worktreeSetup.ts
- **packages/effect-acp/** (2): package.json, tsconfig.json
- **packages/effect-acp/scripts/** (1): generate.ts
- **packages/effect-acp/src/** (12): _generated/meta.gen.ts, _generated/schema-v1.gen.ts, _generated/schema.gen.ts, _internal/shared.ts, _internal/stdio.ts, agent.ts, client.ts, compat.ts, errors.ts, protocol.ts, rpc.ts, schema.ts
- **packages/effect-acp/test/** (2): fixtures/acp-mock-peer.ts, fixtures/antigravity-initialize.json
- **packages/effect-codex-app-server/** (2): package.json, tsconfig.json
- **packages/effect-codex-app-server/scripts/** (1): generate.ts
- **packages/effect-codex-app-server/src/** (11): _generated/meta.gen.ts, _generated/namespaces.gen.ts, _generated/schema.gen.ts, _internal/shared.ts, _internal/stdio.ts, client.ts, errors.ts, protocol.ts, replay.ts, rpc.ts, schema.ts
- **packages/effect-codex-app-server/test/** (2): examples/codex-app-server-probe.ts, fixtures/codex-app-server-mock-peer.ts
- **packages/provider-acp/** (2): package.json, tsconfig.json
- **packages/provider-acp-registry/** (2): package.json, tsconfig.json
- **packages/provider-acp-registry/src/** (17): client.ts, server.ts, server/AcpRegistryRuntimeCoordinator.ts, server/AcpRegistrySupport.ts, server/adapter.ts, server/auth.ts, server/authenticationState.ts, server/claudeAcp.ts, server/copilotAcp.ts, server/devinAcp.ts, server/driver.ts, server/droidAcp.ts, server/probe.ts, server/testing/AcpRegistrySupport.npm.fixture.sh, server/testing/AcpRegistrySupport.uv.fixture.sh, settings.ts, testing.ts
- **packages/provider-acp/src/** (9): server/AcpSessionRuntime.ts, server/adapter.ts, server/clientPolicy.ts, server/clientTerminals.ts, server/mcpOverAcpBridge.ts, server/nativeLogging.ts, server/runtimeModel.ts, server/sessionConfig.ts, server/stderr.ts
- **packages/provider-core/** (2): package.json, tsconfig.json
- **packages/provider-core/src/** (46): client.ts, modelShortName.ts, server/IdAllocator.ts, server/McpProviderSessions.ts, server/ModelCatalog.ts, server/ProviderAdapter.ts, server/ProviderContinuationRequests.ts, server/ProviderEventLoggers.ts, server/ProviderHost.ts, server/ProviderLatestVersions.ts, server/adapterDriver.ts, server/attachmentPrompt.ts, server/auth.ts, server/collectStreamText.ts, server/driver.ts, server/errors.ts, server/failure.ts, server/handoffBudget.ts, server/instanceEnvironment.ts, server/instanceIdentity.ts, server/maintenance.ts, server/maintenanceResolver.ts, server/managedProvider.ts, server/mcpSession.ts, server/mcpToolPresentation.ts, server/nativeProtocolLogging.ts, server/notification.ts, server/orchestrationInstructions.ts, server/pathExpansion.ts, server/processGroup.ts, server/providerAuthFlow.ts, server/randomUuid.ts, server/runtimeInstructions.ts, server/selectionTransition.ts, server/snapshot.ts, server/snapshotProbe.ts, server/snapshotSettings.ts, server/subagentProjection.ts, server/textGeneration.ts, server/textGenerationOperations.ts, server/textGenerationPolicy.ts, server/textGenerationPrompts.ts, server/textGenerationUtils.ts, server/threadTitleContext.ts, server/usage.ts, server/usageLimits.ts
- **packages/provider-cursor/** (2): package.json, tsconfig.json
- **packages/provider-cursor/src/** (24): client.ts, server.ts, server/CursorAccountReader.ts, server/CursorAgentSdk.ts, server/CursorKeychain.ts, server/CursorSdk.ts, server/CursorSdkCatalog.ts, server/CursorUsageAccounts.ts, server/accountCache.ts, server/accountUsage.ts, server/adapter.ts, server/apiKey.ts, server/auth.ts, server/credentialStore.ts, server/driver.ts, server/sdk.ts, server/sdkModel.ts, server/skills.ts, server/status.ts, server/textGeneration.ts, server/transportFailure.ts, server/usageLimits.ts, settings.ts, testing.ts
- **packages/provider-fx/** (2): package.json, tsconfig.json
- **packages/provider-fx/src/** (9): client.ts, server.ts, server/acpSupport.ts, server/adapter.ts, server/driver.ts, server/skills.ts, server/status.ts, settings.ts, testing.ts
- **packages/provider-grok/** (2): package.json, tsconfig.json
- **packages/provider-grok/src/** (14): client.ts, server.ts, server/acpSupport.ts, server/adapter.ts, server/driver.ts, server/probeEnvironment.ts, server/skills.ts, server/status.ts, server/textGeneration.ts, server/usage.ts, server/usageLimits.ts, server/xaiAcpExtension.ts, settings.ts, testing.ts
- **packages/provider-kiro/** (2): package.json, tsconfig.json
- **packages/provider-kiro/src/** (8): client.ts, server.ts, server/acpSupport.ts, server/adapter.ts, server/driver.ts, server/status.ts, settings.ts, testing.ts
- **packages/provider-muse/** (2): package.json, tsconfig.json
- **packages/provider-muse/src/** (16): client.ts, server.ts, server/MuseUsageHome.ts, server/adapter.ts, server/driver.ts, server/itemPresentation.ts, server/maintenance.ts, server/modelCatalog.ts, server/protocol.ts, server/sdk.ts, server/status.ts, server/textGeneration.ts, server/usage.ts, server/usageLimits.ts, settings.ts, testing.ts
- **packages/provider-opencode/** (2): package.json, tsconfig.json
- **packages/provider-opencode/src/** (21): client.ts, server.ts, server/OpenCodeRuntime.ts, server/OpenCodeServerLedger.ts, server/OpenCodeServerOwner.ts, server/adapter.ts, server/driver.ts, server/openCode2Catalog.ts, server/providerErrorMessage.ts, server/status.ts, server/textGeneration.ts, server/toolItems.ts, server/usage.ts, server/usageLimits.ts, server/v2/OpenCode2Client.ts, server/v2/OpenCode2Server.ts, server/v2/adapter.ts, server/v2/textGeneration.ts, server/versionProbe.ts, settings.ts, testing.ts
- **packages/provider-pi/** (2): package.json, tsconfig.json
- **packages/provider-pi/src/** (13): client.ts, server.ts, server/adapter.ts, server/commands.ts, server/driver.ts, server/mcpExtensionSource.ts, server/mcpInjection.ts, server/rpc.ts, server/status.ts, server/textGeneration.ts, server/thinkingCapabilities.ts, server/usage.ts, settings.ts
- **packages/provider-testing/** (2): package.json, tsconfig.json
- **packages/provider-testing/src/** (5): TestProviderHost.ts, fakeCli.ts, replayGate.ts, replayTranscript.ts, replayWorkspace.ts
- **packages/secret-provider-core/** (2): package.json, tsconfig.json
- **packages/secret-provider-core/src/** (3): server/SecretResolver.ts, server/driver.ts, shared/definition.ts
- **packages/secret-provider-definitions/** (2): package.json, tsconfig.json
- **packages/secret-provider-definitions/src/** (1): registry.ts
- **packages/secret-provider-onepassword/** (2): package.json, tsconfig.json
- **packages/secret-provider-onepassword/src/** (2): server/driver.ts, shared/definition.ts
- **packages/shared/src/** (68): AgentScope.ts, Array.ts, HostProcess.ts, KeyedLock.ts, Net.ts, PtyAdapter.ts, Struct.ts, assistantCitations.ts, atomicWrite.ts, authScopeOptions.ts, backgroundActivitySettings.ts, claudeCompaction.ts, cliArgs.ts, cliRelease.ts, codexArtifactTemplates.ts, codexAuthCallback.ts, codexAuthHandoff.ts, codexFileCitations.ts, codexMarkdownDirectives.ts, composerContextReferences.ts, composerInlineTokens.ts, fileLinks.ts, filePreview.ts, generatedImageMarkdown.ts, git.ts, hostClassification.ts, htmlRender.ts, image.ts, keybindings.ts, logging.ts, markdownGithubAlerts.ts, markdownLinks.ts, markdownListIndentation.ts, markdownMath.ts, markdownPipeline.ts, markdownWindowsPaths.ts, mcpApp.ts, mcpResponsePayloads.ts, mediaPreview.ts, model.ts, nodeRuntime.ts, nodeSqliteClient.ts, oauthScope.ts, observability.ts, orchestrationTiming.ts, orchestrationV2PendingBackgroundWork.ts, orchestrationV2ThreadError.ts, otelEnvironment.ts, path.ts, preview.ts, providerAuthReturnUrl.ts, releaseResource.ts, schemaJson.ts, semver.ts, serverSettings.ts, shell.ts, symlink.ts, t3McpToolPresentation.ts, telemetryId.ts, themePalettes.ts, threadLinks.ts, threadPullRequests.ts, toolActivity.ts, toolOutput.ts, usageFormat.ts, usageLimits.ts, usageMerge.ts, video.ts
- **packages/source-control-azure-devops/src/** (2): shared/definition.ts, shared/icon.ts
- **packages/source-control-bitbucket/src/** (2): shared/definition.ts, shared/icon.ts
- **packages/source-control-core/src/** (2): shared/definition.ts, shared/threadPullRequests.ts
- **packages/source-control-definitions/src/** (1): registry.ts
- **packages/source-control-forgejo/src/** (2): shared/definition.ts, shared/icon.ts
- **packages/source-control-gitcafe/src/** (2): shared/definition.ts, shared/icon.ts
- **packages/source-control-github/src/** (4): shared/definition.ts, shared/gitHubMedia.ts, shared/icon.ts, shared/referenceAutolinks.ts
- **packages/source-control-gitlab/src/** (2): shared/definition.ts, shared/icon.ts

## Tier 2: host-port stubs (`kit/`, replace or keep): 10

- `apps/server/src/cloud/config.ts` (original: `host-reference/apps/server/src/cloud/config.ts`)
- `apps/server/src/environment/ServerEnvironment.ts` (original: `host-reference/apps/server/src/environment/ServerEnvironment.ts`)
- `apps/server/src/orchestration-v2/ProjectStore.ts` (original: `host-reference/apps/server/src/orchestration-v2/ProjectStore.ts`)
- `apps/server/src/orchestration-v2/ProjectionStore.ts` (original: `host-reference/apps/server/src/orchestration-v2/ProjectionStore.ts`)
- `apps/server/src/orchestration-v2/ProviderSessionManager.ts` (original: `host-reference/apps/server/src/orchestration-v2/ProviderSessionManager.ts`)
- `apps/server/src/policy/ManagedPolicy.ts` (original: `host-reference/apps/server/src/policy/ManagedPolicy.ts`)
- `apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts` (original: `host-reference/apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts`)
- `apps/server/src/sourceControl/SourceControlProviderRegistry.ts` (original: `host-reference/apps/server/src/sourceControl/SourceControlProviderRegistry.ts`)
- `apps/server/src/sourceControl/sourceControlDefinitions.ts` (original: `host-reference/apps/server/src/sourceControl/sourceControlDefinitions.ts`)
- `apps/server/src/telemetry/AnalyticsService.ts` (original: `host-reference/apps/server/src/telemetry/AnalyticsService.ts`)

## Tier 3: kit composition (added): 3

- `apps/server/src/providerKit/ProviderKitLayer.ts`
- `apps/server/src/providerKit/ProviderKitStandalone.ts`
- `apps/server/src/providerKit/smoke.ts`

## Host boundary: which kit file imports each port

- `apps/server/src/cloud/config.ts`
  - `apps/server/src/telemetry/Identify.ts`: `{ CLOUD_LINKED_USER_ID }`
- `apps/server/src/environment/ServerEnvironment.ts`
  - `apps/server/src/provider/CodexChatGptAuth.ts`: `* as ServerEnvironment`
  - `apps/server/src/provider/CodexChatGptHandoff.ts`: `* as ServerEnvironment`
  - `apps/server/src/provider/CodexManagedRuntime.ts`: `* as ServerEnvironment`
  - `apps/server/src/provider/CodexManagedTokenBroker.ts`: `* as ServerEnvironment`
  - `apps/server/src/provider/Drivers/CodexDriver.ts`: `* as ServerEnvironment`
- `apps/server/src/orchestration-v2/ProjectStore.ts`
  - `apps/server/src/provider/ProjectSettingsOverrideSweep.ts`: `* as ProjectStore`
- `apps/server/src/orchestration-v2/ProjectionStore.ts`
  - `apps/server/src/provider/ProviderAuthService.ts`: `* as ProjectionStore`
- `apps/server/src/orchestration-v2/ProviderSessionManager.ts`
  - `apps/server/src/provider/ProviderAuthService.ts`: `* as ProviderSessionManager`
- `apps/server/src/policy/ManagedPolicy.ts`
  - `apps/server/src/serverSettings.ts`: `* as ManagedPolicy`
- `apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts`
  - `apps/server/src/background/HostPowerMonitor.ts`: `* as DesktopTelemetryReceiver`
- `apps/server/src/sourceControl/SourceControlProviderRegistry.ts`
  - `apps/server/src/textGeneration/TextGeneration.ts`: `* as SourceControlProviderRegistry`
  - `apps/server/src/textGeneration/ThreadTitleLinks.ts`: `* as SourceControlProviderRegistry`
- `apps/server/src/sourceControl/sourceControlDefinitions.ts`
  - `apps/server/src/sourceControl/sourceControlHostSecrets.ts`: `{ sourceControlDefinitions }`
- `apps/server/src/telemetry/AnalyticsService.ts`
  - `apps/server/src/provider/CodexChatGptAuth.ts`: `* as AnalyticsService`
  - `apps/server/src/telemetry/ProviderUsageAnalytics.ts`: `* as AnalyticsService`

## Reference: UI (`ui-reference/`, port, do not install): 135

- **apps/desktop/src/**: preload.ts
- **apps/desktop/src/app/**: CodexAuthCallback.ts, DesktopClerk.ts
- **apps/desktop/src/ipc/**: channels.ts
- **apps/desktop/src/ipc/methods/**: providerAuth.ts
- **apps/mobile/modules/t3-subscription-widget/android/src/main/res/values/**: bools.xml
- **apps/mobile/modules/t3-subscription-widget/android/src/main/res/values-v32/**: bools.xml
- **apps/mobile/src/components/**: ComposerModelControl.tsx, ProviderIcon.tsx
- **apps/mobile/src/features/settings/**: SettingsProviderAccountsRouteScreen.tsx
- **apps/mobile/src/features/threads/**: ChatGptSharingStatus.tsx, ChatGptUsageLimitNotice.tsx, ComposerUsageLimits.tsx, UsageLimitRecoveryCard.tsx, new-task-flow-provider.tsx, provider-catalog-refresh.ts, thread-provider-instance.ts, thread-settings-options.ts
- **apps/mobile/src/features/usage/**: ChatGptUsageSummary.tsx, UsageDailyChart.ios.tsx, UsageDailyChart.tsx, UsageLimitsPooled.tsx, UsageLimitsSection.tsx, UsageRouteScreen.tsx, usageChartData.ts, usageEnvironmentSelection.ts, usageLimitsRefresh.ts, usageProviders.ts
- **apps/mobile/src/lib/**: modelOptions.ts, openExternalUrl.ts, providerOptions.ts
- **apps/mobile/src/state/**: thread-provider-switching.ts, usage.ts, use-model-option-memory.ts
- **apps/mobile/src/widgets/**: SubscriptionUsage.android.tsx, SubscriptionUsage.tsx, SubscriptionUsageCoordinator.tsx, publishSubscriptionUsage.android.ts, publishSubscriptionUsage.ios.ts, publishSubscriptionUsage.ts, subscriptionUsageSnapshot.ts, useSubscriptionUsage.ts
- **apps/web/src/**: modelOrdering.ts, modelPickerVisibility.ts, modelSelection.ts, providerAuthDelivery.ts, providerInstances.ts, providerModels.ts, providerSkillSearch.ts
- **apps/web/src/components/**: Icons.tsx, ProviderUpdateLaunchNotification.logic.ts, ProviderUpdatesAction.tsx
- **apps/web/src/components/chat/**: ChatGptSharingControl.tsx, ComposerModelEffort.tsx, ComposerUsageLimits.tsx, ModelListRow.tsx, ModelPickerContent.tsx, ModelPickerSidebar.tsx, ProviderInstanceIcon.tsx, ProviderModelPicker.tsx, ProviderPackageIcon.tsx, ProviderStatusBanner.tsx, ProviderSubagentBar.tsx, ThreadDetailsUsage.tsx, TraitsPicker.tsx, UsageLimitRecoveryBanner.tsx, composerProviderState.tsx, modelPickerKeys.ts, modelPickerSearch.ts, providerIconUtils.ts, useComposerProviderModel.ts, useMultipleModelSend.ts, useProviderWorkspaceSnapshotRefresh.ts, useUsageLimitsPanel.ts
- **apps/web/src/components/onboarding/**: WelcomeWizard.tsx
- **apps/web/src/components/settings/**: AcpRegistryIcon.tsx, AcpRegistrySearchStep.tsx, AcpSessionManagementSection.tsx, AddCodexAccountDialog.tsx, AddProviderInstanceDialog.logic.ts, AddProviderInstanceDialog.tsx, AddProviderInstanceWizardSteps.tsx, AddUsageLimitSourceDialog.logic.ts, AddUsageLimitSourceDialog.tsx, ChatGptAccountPicker.tsx, ChatGptConnectionButton.tsx, ChatGptUsageButton.tsx, ChatGptWelcomeCoordinator.tsx, CodexSetupSection.logic.ts, CodexSetupSection.tsx, CustomModelEditor.tsx, ProviderAccentColorPicker.tsx, ProviderAuthTerminal.tsx, ProviderAuthenticationSection.tsx, ProviderInstanceCard.tsx, ProviderModelsSection.tsx, ProviderSettingsForm.tsx, ProviderSettingsPanel.logic.ts, ProviderSettingsPanel.tsx, ProviderSetupSection.tsx, ProviderWizardAuthenticationStep.tsx, UsageProviderSettings.tsx, customModelEditor.logic.ts, providerDriverMeta.ts, providerStatus.ts, useScopedModelAvailability.ts
- **apps/web/src/components/sidebar/**: SidebarProviderUpdatePill.tsx
- **apps/web/src/components/usage/**: UsageLimits.tsx, UsageLimitsPooled.tsx, UsageModelDialog.tsx, UsagePage.tsx, UsagePriceOverrides.tsx, UsageProviderChart.tsx, UsageShareBar.tsx, usageBreakdown.ts, usagePagePreferences.ts, usagePriceForm.ts, usagePriceTable.ts, usagePriceTargets.ts, usageProviders.ts, usageShortcuts.ts
- **apps/web/src/onboarding/**: providerReadiness.logic.ts
- **apps/web/src/routes/**: _chat.settings.providers.tsx, _chat.usage.tsx
- **apps/web/src/state/**: serverProviders.logic.ts, usage.ts
- **packages/client-runtime/src/**: providerSkills.ts
- **packages/client-runtime/src/rpc/**: client.ts
- **packages/client-runtime/src/state/**: models.ts, server.ts, serverConfigProjection.ts, sharedSettings.ts, threadCommands.ts, usage.ts, usageAccess.ts

## Reference: transport (`transport-reference/`)

- `ws-provider-handlers.excerpt.ts`: every provider RPC handler from T3 `ws.ts`, with its original line ranges
- `apps/server/src/ws.ts`, `apps/server/src/server.ts`, `apps/server/src/orchestration-v2/runtimeLayer.ts`, `apps/server/src/serverRuntimeStartup.ts`, `packages/contracts/src/rpc.ts`

## Docs (`docs/`)

- `docs/internals/providers.md`
- `docs/internals/adding-a-provider.md`
- `docs/internals/model-manifest.md`
- `docs/internals/effect-services.md`
- `docs/internals/environment-auth.md`
- `docs/orchestration-v2/provider-capability-system.md`
- `docs/orchestration-v2/provider-switching-and-context.md`
- `docs/user/usage.md`
- `docs/user/permission-modes.md`
- `docs/user/install.md`
- `docs/user/managed-policy.md`
- `docs/user/cursor.md`
- `docs/user/providers-acp.md`
- `docs/user/providers-antigravity.md`
- `docs/user/providers-claude.md`
- `docs/user/providers-codex.md`
- `docs/user/providers-fx.md`
- `docs/user/providers-kiro.md`
- `docs/user/providers-muse.md`
- `docs/user/providers-opencode.md`
- `docs/user/providers-pi.md`
