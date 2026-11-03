// HOST PORT (t3-ai-providers-kit): the host's read model of threads. Original (7199 lines): host-reference/apps/server/src/orchestration-v2/ProjectionStore.ts
// ProviderAuthService reads which threads hold live provider sessions so sign-in changes can stop them.
import type { OrchestrationV2ProviderSession, ThreadId } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export type ProjectionRecoveryKind =
  | "queued-runs"
  | "runtime"
  | "subagent-results"
  | "delegated-completions";

export class ProjectionStoreReadError extends Schema.TaggedError<ProjectionStoreReadError>()(
  "ProjectionStoreReadError",
  { detail: Schema.String },
) {}

export type ProjectionStoreV2Error = ProjectionStoreReadError;

export interface ProjectionRecords {
  readonly providerSessions: ReadonlyArray<OrchestrationV2ProviderSession>;
}

export interface ProjectionStoreV2Shape {
  /** "runtime": threads that currently own a provider runtime. */
  readonly getRecoveryThreadIds: (
    kind: ProjectionRecoveryKind,
  ) => Effect.Effect<ReadonlyArray<ThreadId>, ProjectionStoreV2Error>;
  readonly getThreadRecords: <K extends keyof ProjectionRecords>(
    threadId: ThreadId,
    fields: ReadonlyArray<K>,
  ) => Effect.Effect<Pick<ProjectionRecords, K>, ProjectionStoreV2Error>;
}

export class ProjectionStoreV2 extends Context.Service<ProjectionStoreV2, ProjectionStoreV2Shape>()(
  "t3/orchestration-v2/ProjectionStore/ProjectionStoreV2",
) {}

/** For hosts without a thread store: no thread owns a session. */
export const layerEmpty = Layer.succeed(ProjectionStoreV2, {
  getRecoveryThreadIds: Effect.fn("ProjectionStoreV2.getRecoveryThreadIds")(function* () {
    return [];
  }),
  getThreadRecords: Effect.fn("ProjectionStoreV2.getThreadRecords")(function* () {
    return { providerSessions: [] };
  }) as ProjectionStoreV2Shape["getThreadRecords"],
});
