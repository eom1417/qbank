// HOST PORT (t3-ai-providers-kit): the host's project list. Original: host-reference/apps/server/src/orchestration-v2/ProjectStore.ts
// ProjectSettingsOverrideSweep lists projects to drop per-project provider overrides for deleted projects.
import type { OrchestrationProjectShell, ProjectId } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export class ProjectStoreV2Error extends Schema.TaggedError<ProjectStoreV2Error>()(
  "ProjectStoreV2Error",
  { operation: Schema.String, detail: Schema.String },
) {}

export class ProjectStoreV2 extends Context.Service<
  ProjectStoreV2,
  {
    readonly listShells: (options?: {
      readonly projectIds?: ReadonlyArray<ProjectId>;
    }) => Effect.Effect<ReadonlyArray<OrchestrationProjectShell>, ProjectStoreV2Error>;
  }
>()("t3/orchestration-v2/ProjectStore/ProjectStoreV2") {}

export const layerEmpty = Layer.succeed(ProjectStoreV2, {
  listShells: Effect.fn("ProjectStoreV2.listShells")(function* () {
    return [];
  }),
});
