// HOST PORT (t3-ai-providers-kit): the host app implements this. Original: host-reference/apps/server/src/environment/ServerEnvironment.ts
// The kit only reads a stable per-installation environment id (Codex ChatGPT sign-in, managed token broker, handoff).
import type { EnvironmentId, ExecutionEnvironmentDescriptor } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export class ServerEnvironment extends Context.Service<
  ServerEnvironment,
  {
    readonly getEnvironmentId: Effect.Effect<EnvironmentId>;
    readonly getDescriptor: Effect.Effect<ExecutionEnvironmentDescriptor>;
  }
>()("t3/environment/ServerEnvironment") {}

export class ServerEnvironmentIdentity extends Context.Service<
  ServerEnvironmentIdentity,
  {
    readonly getEnvironmentId: Effect.Effect<EnvironmentId>;
  }
>()("t3/environment/ServerEnvironment/ServerEnvironmentIdentity") {}

/** Persist `environmentId` once per installation (the original stores a random UUID under the state dir). */
export const layerIdentityStatic = (environmentId: EnvironmentId) =>
  Layer.succeed(ServerEnvironmentIdentity, { getEnvironmentId: Effect.succeed(environmentId) });
