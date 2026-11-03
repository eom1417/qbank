/**
 * ProviderKitStandalone - ProviderKitLayer with every host port filled by a working default, so the
 * provider system runs inside any Node process with no other T3 Code code.
 *
 * Replace a default with your own implementation when your app has that concept (threads, projects,
 * admin policy, source control). See INTEGRATION_GUIDE.md §4 for what each port does.
 *
 * @module ProviderKitStandalone
 */
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import type { EnvironmentId } from "@t3tools/contracts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import { FetchHttpClient } from "effect/http";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as SqlClient from "effect/sql/SqlClient";

import * as ServerConfig from "../config.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as ProviderSessionManager from "../orchestration-v2/ProviderSessionManager.ts";
import * as ManagedPolicy from "../policy/ManagedPolicy.ts";
import * as DesktopTelemetryReceiver from "../resourceTelemetry/DesktopTelemetryReceiver.ts";
import * as SourceControlProviderRegistry from "../sourceControl/SourceControlProviderRegistry.ts";
import * as ProviderKitLayer from "./ProviderKitLayer.ts";

export interface ProviderKitStandaloneOptions {
  /** Working directory providers run in when a request names none. */
  readonly cwd: string;
  /** Kit home: userdata/settings.json, userdata/secrets/, userdata/providers.sqlite, caches/, logs/. */
  readonly baseDir: string;
  /** Stable id for this installation (persist it; Codex ChatGPT sign-in binds tokens to it). */
  readonly environmentId: EnvironmentId;
}

/**
 * ServerSettings reads three legacy T3 tables once, to migrate old settings. A fresh database has
 * none of them, so create them empty; the migration then finds nothing and moves on.
 */
export const ensureLegacySettingsTables = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE IF NOT EXISTS projection_thread_sessions (provider_name TEXT, provider_instance_id TEXT)`;
  yield* sql`CREATE TABLE IF NOT EXISTS provider_session_runtime (provider_name TEXT, provider_instance_id TEXT)`;
  yield* sql`CREATE TABLE IF NOT EXISTS projection_projects (project_id TEXT, default_model_selection_json TEXT, default_thread_env_mode TEXT, auto_pull INTEGER, scripts_json TEXT, deleted_at TEXT)`;
});

/** Opened after ServerConfig, which creates the state directory. */
const layerSql = Layer.unwrap(
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const { stateDir } = yield* ServerConfig.ServerConfig;
    return NodeSqliteClient.layer({ filename: path.join(stateDir, "providers.sqlite") });
  }),
).pipe(Layer.tap((context) => ensureLegacySettingsTables.pipe(Effect.provide(context))));

export const layerHostPorts = (options: ProviderKitStandaloneOptions) =>
  Layer.mergeAll(
    ServerEnvironment.layerIdentityStatic(options.environmentId),
    ManagedPolicy.layerUnmanaged,
    ProjectionStore.layerEmpty,
    ProjectStore.layerEmpty,
    ProviderSessionManager.layerNoop,
    DesktopTelemetryReceiver.layerNone,
    SourceControlProviderRegistry.layerNone,
    layerSql,
  ).pipe(Layer.provideMerge(ServerConfig.ServerConfig.layerTest(options.cwd, options.baseDir)));

export const layer = (options: ProviderKitStandaloneOptions) =>
  ProviderKitLayer.layer.pipe(
    Layer.provideMerge(layerHostPorts(options)),
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)),
  );
