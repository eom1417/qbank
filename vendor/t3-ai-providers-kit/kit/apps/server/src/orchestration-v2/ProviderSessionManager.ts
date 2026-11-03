// HOST PORT (t3-ai-providers-kit): the host's live-session owner. Original (2565 lines): host-reference/apps/server/src/orchestration-v2/ProviderSessionManager.ts
// The kit calls `release` when a sign-in change must stop sessions that used the old credentials.
// A host that opens sessions itself should implement the full shape from the original file.
import type { ProviderSessionId } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export type ProviderSessionReleaseReason = "idle" | "manual_shutdown" | "error" | "replaced";

export class ProviderSessionReleaseError extends Schema.TaggedError<ProviderSessionReleaseError>()(
  "ProviderSessionReleaseError",
  { providerSessionId: Schema.String, detail: Schema.String },
) {}

export type ProviderSessionManagerV2Error = ProviderSessionReleaseError;

export interface ProviderSessionManagerV2Shape {
  readonly release: (input: {
    readonly providerSessionId: ProviderSessionId;
    readonly reason: ProviderSessionReleaseReason;
    readonly detail?: string;
  }) => Effect.Effect<void, ProviderSessionManagerV2Error>;
}

export class ProviderSessionManagerV2 extends Context.Service<
  ProviderSessionManagerV2,
  ProviderSessionManagerV2Shape
>()("t3/orchestration-v2/ProviderSessionManager/ProviderSessionManagerV2") {}

/** For hosts without persistent sessions: nothing to release. */
export const layerNoop = Layer.succeed(ProviderSessionManagerV2, {
  release: Effect.fn("ProviderSessionManagerV2.release")(function* () {}),
});
